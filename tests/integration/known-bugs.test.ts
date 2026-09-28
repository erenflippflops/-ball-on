import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { io, Socket } from 'socket.io-client';

const PORT = 3102;
const SERVER_URL = `http://127.0.0.1:${PORT}`;

let serverProcess: ChildProcess;

async function waitForServer(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${SERVER_URL}/health`);
      if (response.ok) return;
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Server failed to start');
}

function createSocket(): Socket {
  return io(SERVER_URL, { transports: ['websocket'] });
}

function emitAck<T = any>(socket: Socket, event: string, payload: any, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout on ${event}`)), timeoutMs);
    socket.emit(event, payload, (response: T) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

async function reachMatchPhase(s1: Socket, s2: Socket, roomId: string): Promise<any> {
  let currentRoom: any;
  s1.on('room_updated', (r: any) => { currentRoom = r; });

  await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'first_half_auction' && r(d)));

  // First half
  let maxIterations = 100;
  while (currentRoom.phase === 'first_half_auction' && maxIterations-- > 0) {
    const bid1Res = await emitAck(s1, 'place_bid', { roomId, amount: 1 });
    if (!bid1Res.success) await emitAck(s1, 'skip_player', { roomId });
    await emitAck(s2, 'skip_player', { roomId });
    await new Promise(r => {
      const timeout = setTimeout(r, 200);
      const listener = () => { clearTimeout(timeout); r(undefined); };
      s1.once('next_player', listener);
      s1.once('phase_changed', listener);
    });
  }

  await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'halftime' && r(d)));
  await emitAck(s1, 'finish_halftime', { roomId });
  await emitAck(s2, 'finish_halftime', { roomId });
  await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'second_half_auction' && r(d)));

  // Second half
  maxIterations = 100;
  while (currentRoom.phase === 'second_half_auction' && maxIterations-- > 0) {
    const bid1Res = await emitAck(s1, 'place_bid', { roomId, amount: 1 });
    if (!bid1Res.success) await emitAck(s1, 'skip_player', { roomId });
    await emitAck(s2, 'skip_player', { roomId });
    await new Promise(r => {
      const timeout = setTimeout(r, 200);
      const listener = () => { clearTimeout(timeout); r(undefined); };
      s1.once('next_player', listener);
      s1.once('phase_changed', listener);
    });
  }

  await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'steal' && r(d)));

  await emitAck(s1, 'submit_steal', {
    roomId,
    target: currentRoom.teams[1].roster[0].id,
    offer: currentRoom.teams[0].roster[1].id,
    protect: currentRoom.teams[0].roster[2].id
  });
  await emitAck(s2, 'submit_steal', {
    roomId,
    target: currentRoom.teams[0].roster[0].id,
    offer: currentRoom.teams[1].roster[1].id,
    protect: currentRoom.teams[1].roster[2].id
  });

  await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'trade' && r(d)));
  await emitAck(s1, 'trade_response', { roomId, accept: false });
  await emitAck(s2, 'trade_response', { roomId, accept: false });

  await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'match' && r(d)));

  return currentRoom;
}

beforeAll(async () => {
  serverProcess = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server/index.ts'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe'
  });
  await waitForServer();
}, 60000);

afterAll(async () => {
  if (serverProcess) {
    serverProcess.kill();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
});

describe('Known Bug K1', () => {
  it('KNOWN BUG K1 (current symptom): phase is match, no match_result within 3s, phase stays match', async () => {
    const s1 = createSocket();
    const s2 = createSocket();

    try {
      await Promise.all([
        new Promise(r => s1.on('connect', r)),
        new Promise(r => s2.on('connect', r))
      ]);

      const createRes = await emitAck(s1, 'create_room', { nickname: 'P1', maxPlayers: 2, competition: 'Test' });
      const roomId = createRes.roomId;

      await emitAck(s2, 'join_room', { roomId, nickname: 'P2' });
      await emitAck(s1, 'start_game', { roomId });
      await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'tactic_selection' && r(d)));

      await emitAck(s1, 'select_tactic', { roomId, tacticId: 'balanced', formation: '4-3-3' });
      await emitAck(s2, 'select_tactic', { roomId, tacticId: 'balanced', formation: '4-3-3' });

      const currentRoom = await reachMatchPhase(s1, s2, roomId);

      // Current symptom: phase is 'match', no match_result arrives, phase stays 'match'
      expect(currentRoom.phase).toBe('match');

      const matchResultReceived = await Promise.race([
        new Promise((resolve) => s1.once('match_result', () => resolve(true))),
        new Promise((resolve) => setTimeout(() => resolve(false), 3000))
      ]);

      expect(matchResultReceived).toBe(false);
      expect(currentRoom.phase).toBe('match');
    } finally {
      s1.disconnect();
      s2.disconnect();
    }
  }, 60000);

  it.fails('KNOWN BUG K1 (correct behavior): match_result arrives automatically within 3s, phase becomes result', async () => {
    const s1 = createSocket();
    const s2 = createSocket();

    try {
      await Promise.all([
        new Promise(r => s1.on('connect', r)),
        new Promise(r => s2.on('connect', r))
      ]);

      const createRes = await emitAck(s1, 'create_room', { nickname: 'P1', maxPlayers: 2, competition: 'Test' });
      const roomId = createRes.roomId;

      await emitAck(s2, 'join_room', { roomId, nickname: 'P2' });
      await emitAck(s1, 'start_game', { roomId });
      await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'tactic_selection' && r(d)));

      await emitAck(s1, 'select_tactic', { roomId, tacticId: 'balanced', formation: '4-3-3' });
      await emitAck(s2, 'select_tactic', { roomId, tacticId: 'balanced', formation: '4-3-3' });

      let currentRoom = await reachMatchPhase(s1, s2, roomId);
      s1.on('room_updated', (r: any) => { currentRoom = r; });

      expect(currentRoom.phase).toBe('match');

      // Correct behavior: match_result arrives automatically
      const matchResult: any = await new Promise((resolve, reject) => {
        s1.once('match_result', resolve);
        setTimeout(() => reject(new Error('No match_result within 3s')), 3000);
      });

      expect(matchResult.homeScore).toBeGreaterThanOrEqual(0);
      expect(currentRoom.phase).toBe('result');
    } finally {
      s1.disconnect();
      s2.disconnect();
    }
  }, 60000);
});

describe('Known Bug K2', () => {
  it('KNOWN BUG K2 (current symptom): quiz_start_game ack is {success:false, error:"Yalnızca host oyunu başlatabilir"}', async () => {
    const s1 = createSocket();
    const s2 = createSocket();

    try {
      await Promise.all([
        new Promise(r => s1.on('connect', r)),
        new Promise(r => s2.on('connect', r))
      ]);

      const createRes = await emitAck(s1, 'quiz_create_room', { nickname: 'Host', mode: 'solo' });
      const roomCode = createRes.room.id;

      await emitAck(s2, 'quiz_join_room', { roomId: roomCode, nickname: 'Player2' });
      await new Promise(r => setTimeout(r, 500));

      const startRes = await emitAck(s1, 'quiz_start_game', { roomId: roomCode });

      expect(startRes.success).toBe(false);
      expect(startRes.error).toBe('Yalnızca host oyunu başlatabilir');
    } finally {
      s1.disconnect();
      s2.disconnect();
    }
  }, 30000);

  it.fails('KNOWN BUG K2 (correct behavior): host start succeeds, both receive quiz_game_started', async () => {
    const s1 = createSocket();
    const s2 = createSocket();

    try {
      await Promise.all([
        new Promise(r => s1.on('connect', r)),
        new Promise(r => s2.on('connect', r))
      ]);

      const createRes = await emitAck(s1, 'quiz_create_room', { nickname: 'Host', mode: 'solo' });
      const roomCode = createRes.room.id;

      await emitAck(s2, 'quiz_join_room', { roomId: roomCode, nickname: 'Player2' });
      await new Promise(r => setTimeout(r, 500));

      const startRes = await emitAck(s1, 'quiz_start_game', { roomId: roomCode });
      expect(startRes.success).toBe(true);

      const gameStarted1 = await new Promise(r => s1.once('quiz_game_started', r));
      const gameStarted2 = await new Promise(r => s2.once('quiz_game_started', r));

      expect(gameStarted1).toBeDefined();
      expect(gameStarted2).toBeDefined();
    } finally {
      s1.disconnect();
      s2.disconnect();
    }
  }, 30000);
});

describe('Known Bug K4', () => {
  it('KNOWN BUG K4 (current symptom): outsider simulate_match ack {success:true}, room members receive match_result and phase becomes result', async () => {
    const s1 = createSocket();
    const s2 = createSocket();
    const outsider = createSocket();

    try {
      await Promise.all([
        new Promise(r => s1.on('connect', r)),
        new Promise(r => s2.on('connect', r)),
        new Promise(r => outsider.on('connect', r))
      ]);

      const createRes = await emitAck(s1, 'create_room', { nickname: 'P1', maxPlayers: 2, competition: 'Test' });
      const roomId = createRes.roomId;

      await emitAck(s2, 'join_room', { roomId, nickname: 'P2' });
      await emitAck(s1, 'start_game', { roomId });
      await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'tactic_selection' && r(d)));

      await emitAck(s1, 'select_tactic', { roomId, tacticId: 'balanced', formation: '4-3-3' });
      await emitAck(s2, 'select_tactic', { roomId, tacticId: 'balanced', formation: '4-3-3' });

      let currentRoom = await reachMatchPhase(s1, s2, roomId);
      s1.on('room_updated', (r: any) => { currentRoom = r; });

      expect(currentRoom.phase).toBe('match');

      // Outsider never joined but emits simulate_match
      const simRes = await emitAck(outsider, 'simulate_match', { roomId });

      // Current symptom: ack is {success:true}
      expect(simRes.success).toBe(true);

      // Room members receive match_result
      const matchResult = await new Promise((resolve) => {
        s1.once('match_result', resolve);
        setTimeout(() => resolve(null), 2000);
      });

      expect(matchResult).not.toBeNull();

      // Phase becomes result
      await new Promise(r => setTimeout(r, 500));
      expect(currentRoom.phase).toBe('result');
    } finally {
      s1.disconnect();
      s2.disconnect();
      outsider.disconnect();
    }
  }, 60000);

  it.fails('KNOWN BUG K4 (correct behavior): outsider simulate_match rejected, room unchanged', async () => {
    const s1 = createSocket();
    const s2 = createSocket();
    const outsider = createSocket();

    try {
      await Promise.all([
        new Promise(r => s1.on('connect', r)),
        new Promise(r => s2.on('connect', r)),
        new Promise(r => outsider.on('connect', r))
      ]);

      const createRes = await emitAck(s1, 'create_room', { nickname: 'P1', maxPlayers: 2, competition: 'Test' });
      const roomId = createRes.roomId;

      await emitAck(s2, 'join_room', { roomId, nickname: 'P2' });
      await emitAck(s1, 'start_game', { roomId });
      await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'tactic_selection' && r(d)));

      await emitAck(s1, 'select_tactic', { roomId, tacticId: 'balanced', formation: '4-3-3' });
      await emitAck(s2, 'select_tactic', { roomId, tacticId: 'balanced', formation: '4-3-3' });

      let currentRoom = await reachMatchPhase(s1, s2, roomId);
      s1.on('room_updated', (r: any) => { currentRoom = r; });

      const phaseBeforeAttempt = currentRoom.phase;

      const simRes = await emitAck(outsider, 'simulate_match', { roomId });
      expect(simRes.success).toBe(false);

      await new Promise(r => setTimeout(r, 2000));
      expect(currentRoom.phase).toBe(phaseBeforeAttempt);
    } finally {
      s1.disconnect();
      s2.disconnect();
      outsider.disconnect();
    }
  }, 60000);
});
