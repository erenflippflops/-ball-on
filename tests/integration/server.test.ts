import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { io, Socket } from 'socket.io-client';

const PORT = 3101;
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

describe('BALL-ON 2 humans full flow', () => {
  it('lobby -> tactic_selection -> first_half_auction -> halftime -> second_half_auction -> steal -> trade -> match -> result', async () => {
    const s1 = createSocket();
    const s2 = createSocket();

    try {
      await Promise.all([
        new Promise(r => s1.on('connect', r)),
        new Promise(r => s2.on('connect', r))
      ]);

      // Create room
      const createRes = await emitAck(s1, 'create_room', { nickname: 'P1', maxPlayers: 2, competition: 'Test' });
      expect(createRes.success).toBe(true);
      const roomId = createRes.roomId;
      expect(createRes.room.phase).toBe('lobby');

      // Join
      const joinRes = await emitAck(s2, 'join_room', { roomId, nickname: 'P2' });
      expect(joinRes.success).toBe(true);
      expect(joinRes.room.teams).toHaveLength(2);

      // Start game -> tactic_selection
      await emitAck(s1, 'start_game', { roomId });
      await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'tactic_selection' && r(d)));

      // Both select tactics
      await emitAck(s1, 'select_tactic', { roomId, tacticId: 'balanced', formation: '4-3-3' });
      await emitAck(s2, 'select_tactic', { roomId, tacticId: 'balanced', formation: '4-3-3' });

      // Wait for first_half_auction (~2.5s after last tactic)
      const phases: string[] = [];
      let currentRoom: any;
      s1.on('phase_changed', (d: any) => { phases.push(d.phase); });
      s1.on('room_updated', (r: any) => { currentRoom = r; });

      await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'first_half_auction' && r(d)));
      expect(phases).toContain('first_half_auction');

      // Mix bids and skips until 11 players each
      let playersSold = 0;
      let maxIterations = 100;
      while (currentRoom.phase === 'first_half_auction' && maxIterations-- > 0) {
        const team1 = currentRoom.teams[0];
        const team2 = currentRoom.teams[1];

        if (team1.roster.length >= 11 && team2.roster.length >= 11) break;

        // Try bid for team1, skip if rejected
        const bid1Res = await emitAck(s1, 'place_bid', { roomId, amount: 1 });
        if (!bid1Res.success) {
          await emitAck(s1, 'skip_player', { roomId });
        }

        await emitAck(s2, 'skip_player', { roomId });

        // Wait for next player or phase change
        await new Promise(r => {
          const timeout = setTimeout(r, 200);
          const listener = () => { clearTimeout(timeout); r(undefined); };
          s1.once('next_player', listener);
          s1.once('phase_changed', listener);
        });

        playersSold++;
      }

      if (maxIterations <= 0) {
        throw new Error(`Stuck in first_half_auction after 100 iterations. Phase: ${currentRoom.phase}, rosters: ${currentRoom.teams[0].roster.length}/${currentRoom.teams[1].roster.length}`);
      }

      // Assert halftime reached
      if (!phases.includes('halftime')) {
        await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'halftime' && r(d)));
      }
      expect(phases).toContain('halftime');

      // Finish halftime -> second_half_auction
      await emitAck(s1, 'finish_halftime', { roomId });
      await emitAck(s2, 'finish_halftime', { roomId });
      await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'second_half_auction' && r(d)));
      expect(phases).toContain('second_half_auction');

      // Second half auction until steal
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

      if (maxIterations <= 0) {
        throw new Error(`Stuck in second_half_auction. Phase: ${currentRoom.phase}`);
      }

      if (!phases.includes('steal')) {
        await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'steal' && r(d)));
      }
      expect(phases).toContain('steal');

      // At steal, check rosters
      expect(currentRoom.teams[0].roster).toHaveLength(11);
      expect(currentRoom.teams[1].roster).toHaveLength(11);

      // Check no duplicate IDs
      const allIds = [
        ...currentRoom.teams[0].roster.map((p: any) => p.id),
        ...currentRoom.teams[1].roster.map((p: any) => p.id)
      ];
      expect(new Set(allIds).size).toBe(allIds.length);

      // Check budgets non-negative
      expect(currentRoom.teams[0].budget).toBeGreaterThanOrEqual(0);
      expect(currentRoom.teams[1].budget).toBeGreaterThanOrEqual(0);

      // Check position limits during auction
      for (const team of currentRoom.teams) {
        const gk = team.roster.filter((p: any) => p.primaryPosition === 'GK').length;
        const def = team.roster.filter((p: any) => ['CB', 'LB', 'RB'].includes(p.primaryPosition)).length;
        const mid = team.roster.filter((p: any) => ['CM', 'CDM', 'CAM', 'LM', 'RM'].includes(p.primaryPosition)).length;
        const att = team.roster.filter((p: any) => ['ST', 'LW', 'RW', 'CF'].includes(p.primaryPosition)).length;

        expect(gk).toBeLessThanOrEqual(1);
        expect(def).toBeLessThanOrEqual(4);
        expect(mid).toBeLessThanOrEqual(3);
        expect(att).toBeLessThanOrEqual(3);
      }

      // Submit steal
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

      // Wait for trade phase
      await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'trade' && r(d)));
      expect(phases).toContain('trade');

      // Decline trades
      await emitAck(s1, 'trade_response', { roomId, accept: false });
      await emitAck(s2, 'trade_response', { roomId, accept: false });

      // Wait for match phase
      await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'match' && r(d)));
      expect(phases).toContain('match');

      // K1 workaround: manually simulate
      await emitAck(s1, 'simulate_match', { roomId });

      const matchResult: any = await new Promise(r => s1.once('match_result', r));
      expect(Number.isInteger(matchResult.homeScore)).toBe(true);
      expect(Number.isInteger(matchResult.awayScore)).toBe(true);
      expect(matchResult.homeScore).toBeGreaterThanOrEqual(0);
      expect(matchResult.awayScore).toBeGreaterThanOrEqual(0);

      await new Promise(r => setTimeout(r, 500));
      expect(currentRoom.phase).toBe('result');

      // Verify phase order
      expect(phases).toEqual(['first_half_auction', 'halftime', 'second_half_auction', 'steal', 'trade', 'match']);
    } finally {
      s1.disconnect();
      s2.disconnect();
    }
  }, 60000);
});

describe('BALL-ON bot mode full flow', () => {
  it('1 human + bot: lobby -> ... -> result', async () => {
    const s1 = createSocket();

    try {
      await new Promise(r => s1.on('connect', r));

      const createRes = await emitAck(s1, 'create_room', { nickname: 'Human', maxPlayers: 2, competition: 'Test' });
      const roomId = createRes.roomId;

      await emitAck(s1, 'start_game', { roomId });
      await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'tactic_selection' && r(d)));

      await emitAck(s1, 'select_tactic', { roomId, tacticId: 'balanced', formation: '4-3-3' });

      const phases: string[] = [];
      let currentRoom: any;
      s1.on('phase_changed', (d: any) => { phases.push(d.phase); });
      s1.on('room_updated', (r: any) => { currentRoom = r; });

      await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'first_half_auction' && r(d)));

      // Skip through first half
      let maxIterations = 100;
      while (currentRoom.phase === 'first_half_auction' && maxIterations-- > 0) {
        const bidRes = await emitAck(s1, 'place_bid', { roomId, amount: 1 });
        if (!bidRes.success) await emitAck(s1, 'skip_player', { roomId });

        await new Promise(r => {
          const timeout = setTimeout(r, 200);
          const listener = () => { clearTimeout(timeout); r(undefined); };
          s1.once('next_player', listener);
          s1.once('phase_changed', listener);
        });
      }

      if (!phases.includes('halftime')) {
        await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'halftime' && r(d)));
      }

      await emitAck(s1, 'finish_halftime', { roomId });
      await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'second_half_auction' && r(d)));

      // Second half
      maxIterations = 100;
      while (currentRoom.phase === 'second_half_auction' && maxIterations-- > 0) {
        const bidRes = await emitAck(s1, 'place_bid', { roomId, amount: 1 });
        if (!bidRes.success) await emitAck(s1, 'skip_player', { roomId });

        await new Promise(r => {
          const timeout = setTimeout(r, 200);
          const listener = () => { clearTimeout(timeout); r(undefined); };
          s1.once('next_player', listener);
          s1.once('phase_changed', listener);
        });
      }

      if (!phases.includes('steal')) {
        await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'steal' && r(d)));
      }

      const botTeam = currentRoom.teams.find((t: any) => t.id.startsWith('bot-'));
      expect(botTeam).toBeDefined();
      expect(botTeam.roster).toHaveLength(11);
      expect(currentRoom.teams[0].roster).toHaveLength(11);

      await emitAck(s1, 'submit_steal', {
        roomId,
        target: botTeam.roster[0].id,
        offer: currentRoom.teams[0].roster[1].id,
        protect: currentRoom.teams[0].roster[2].id
      });

      await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'trade' && r(d)));

      await emitAck(s1, 'trade_response', { roomId, accept: false });

      await new Promise(r => s1.once('phase_changed', (d: any) => d.phase === 'match' && r(d)));

      await emitAck(s1, 'simulate_match', { roomId });

      const matchResult: any = await new Promise(r => s1.once('match_result', r));
      expect(matchResult.homeScore).toBeGreaterThanOrEqual(0);
      expect(matchResult.awayScore).toBeGreaterThanOrEqual(0);

      await new Promise(r => setTimeout(r, 500));
      expect(currentRoom.phase).toBe('result');
    } finally {
      s1.disconnect();
    }
  }, 60000);
});

describe('AMO ARENA', () => {
  it('create room and second player joins', async () => {
    const s1 = createSocket();
    const s2 = createSocket();

    try {
      await Promise.all([
        new Promise(r => s1.on('connect', r)),
        new Promise(r => s2.on('connect', r))
      ]);

      const createRes = await emitAck(s1, 'quiz_create_room', { nickname: 'Host', mode: 'solo' });
      expect(createRes.room.players).toHaveLength(1);
      const roomCode = createRes.room.id;

      const joinRes = await emitAck(s2, 'quiz_join_room', { roomId: roomCode, nickname: 'Player2' });
      expect(joinRes.room.players).toHaveLength(2);

      const room1Update: any = await new Promise(r => s1.once('quiz_room_updated', r));
      expect(room1Update.players).toHaveLength(2);
    } finally {
      s1.disconnect();
      s2.disconnect();
    }
  }, 30000);
});
