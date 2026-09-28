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

function waitForEvent<T>(socket: Socket, event: string, timeout = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
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

describe('BALL-ON integration', () => {
  it('2 humans: full flow from lobby to match phase', async () => {
    const socket1 = createSocket();
    const socket2 = createSocket();

    try {
      await Promise.all([
        new Promise(resolve => socket1.on('connect', resolve)),
        new Promise(resolve => socket2.on('connect', resolve))
      ]);

      // Create room
      socket1.emit('create_room', { nick: 'Player1', maxPlayers: 2, competition: 'Premier League' });
      const room1 = await waitForEvent<any>(socket1, 'room_updated');
      expect(room1.phase).toBe('lobby');
      const roomCode = room1.id;

      // Player 2 joins
      socket2.emit('join_room', { room: roomCode, nick: 'Player2' });
      const room2 = await waitForEvent<any>(socket2, 'room_updated');
      expect(room2.teams).toHaveLength(2);

      // Start game
      socket1.emit('start_game');
      const tacticPhase1 = await waitForEvent<any>(socket1, 'room_updated');
      expect(tacticPhase1.phase).toBe('tactic_selection');

      // Both select tactics
      socket1.emit('select_tactic', { tactic: 'tiki-taka', formation: '4-3-3' });
      socket2.emit('select_tactic', { tactic: 'tiki-taka', formation: '4-3-3' });

      const auctionPhase1 = await waitForEvent<any>(socket1, 'room_updated');
      expect(auctionPhase1.phase).toBe('first_half_auction');

      // Track phases
      const phases: string[] = [auctionPhase1.phase];
      let currentRoom = auctionPhase1;

      const phaseListener = (room: any) => {
        if (room.phase !== phases[phases.length - 1]) {
          phases.push(room.phase);
        }
        currentRoom = room;
      };

      socket1.on('room_updated', phaseListener);
      socket2.on('room_updated', phaseListener);

      // Skip players until halftime
      while (currentRoom.phase === 'first_half_auction' && currentRoom.teams[0].roster.length < 11) {
        socket1.emit('skip_player');
        socket2.emit('skip_player');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Wait for halftime
      await new Promise(resolve => setTimeout(resolve, 2000));
      expect(phases).toContain('halftime');

      // Finish halftime
      socket1.emit('finish_halftime');
      socket2.emit('finish_halftime');
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(phases).toContain('second_half_auction');

      // Skip until steal phase
      while (currentRoom.phase === 'second_half_auction' && currentRoom.teams[0].roster.length < 11) {
        socket1.emit('skip_player');
        socket2.emit('skip_player');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      expect(phases).toContain('steal');

      // At steal phase, check roster sizes
      expect(currentRoom.teams[0].roster).toHaveLength(11);
      expect(currentRoom.teams[1].roster).toHaveLength(11);

      // Check no duplicate player IDs
      const allPlayerIds = [
        ...currentRoom.teams[0].roster.map((p: any) => p.id),
        ...currentRoom.teams[1].roster.map((p: any) => p.id)
      ];
      const uniqueIds = new Set(allPlayerIds);
      expect(uniqueIds.size).toBe(allPlayerIds.length);

      // Check budgets non-negative
      expect(currentRoom.teams[0].budget).toBeGreaterThanOrEqual(0);
      expect(currentRoom.teams[1].budget).toBeGreaterThanOrEqual(0);

      // Submit steal choices
      const player1ToSteal = currentRoom.teams[1].roster[0];
      const player2ToSteal = currentRoom.teams[0].roster[0];
      const offer1 = currentRoom.teams[0].roster[1];
      const offer2 = currentRoom.teams[1].roster[1];
      const protect1 = currentRoom.teams[0].roster[2];
      const protect2 = currentRoom.teams[1].roster[2];

      socket1.emit('submit_steal', {
        target: currentRoom.teams[1].id,
        offer: offer1.id,
        protect: protect1.id
      });
      socket2.emit('submit_steal', {
        target: currentRoom.teams[0].id,
        offer: offer2.id,
        protect: protect2.id
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
      expect(phases).toContain('trade');

      // Respond to trade offers (decline all)
      while (currentRoom.phase === 'trade') {
        socket1.emit('trade_response', { accept: false });
        socket2.emit('trade_response', { accept: false });
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      expect(phases).toContain('match');

      // Verify phase order
      expect(phases).toEqual([
        'first_half_auction',
        'halftime',
        'second_half_auction',
        'steal',
        'trade',
        'match'
      ]);

      // Workaround for K1: manually trigger simulate_match
      socket1.emit('simulate_match');
      const matchResult = await waitForEvent<any>(socket1, 'match_result', 15000);

      expect(matchResult.homeScore).toBeGreaterThanOrEqual(0);
      expect(matchResult.awayScore).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(matchResult.homeScore)).toBe(true);
      expect(Number.isInteger(matchResult.awayScore)).toBe(true);

      const finalRoom = await waitForEvent<any>(socket1, 'room_updated');
      expect(finalRoom.phase).toBe('result');
    } finally {
      socket1.disconnect();
      socket2.disconnect();
    }
  }, 120000);

  it.fails('KNOWN BUG K1: match never starts without manual simulate_match', async () => {
    const socket1 = createSocket();
    const socket2 = createSocket();

    try {
      await Promise.all([
        new Promise(resolve => socket1.on('connect', resolve)),
        new Promise(resolve => socket2.on('connect', resolve))
      ]);

      socket1.emit('create_room', { nick: 'P1', maxPlayers: 2, competition: 'Test' });
      const room1 = await waitForEvent<any>(socket1, 'room_updated');
      socket2.emit('join_room', { room: room1.id, nick: 'P2' });
      await waitForEvent<any>(socket2, 'room_updated');

      socket1.emit('start_game');
      await waitForEvent<any>(socket1, 'room_updated');

      socket1.emit('select_tactic', { tactic: 'balanced', formation: '4-3-3' });
      socket2.emit('select_tactic', { tactic: 'balanced', formation: '4-3-3' });
      await waitForEvent<any>(socket1, 'room_updated');

      let currentRoom: any;
      const listener = (room: any) => { currentRoom = room; };
      socket1.on('room_updated', listener);

      // Skip to end
      for (let i = 0; i < 30; i++) {
        socket1.emit('skip_player');
        socket2.emit('skip_player');
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      socket1.emit('finish_halftime');
      socket2.emit('finish_halftime');
      await new Promise(resolve => setTimeout(resolve, 1000));

      for (let i = 0; i < 30; i++) {
        socket1.emit('skip_player');
        socket2.emit('skip_player');
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      const target1 = currentRoom.teams[1].roster[0];
      const target2 = currentRoom.teams[0].roster[0];
      socket1.emit('submit_steal', {
        target: currentRoom.teams[1].id,
        offer: currentRoom.teams[0].roster[1].id,
        protect: currentRoom.teams[0].roster[2].id
      });
      socket2.emit('submit_steal', {
        target: currentRoom.teams[0].id,
        offer: currentRoom.teams[1].roster[1].id,
        protect: currentRoom.teams[1].roster[2].id
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      for (let i = 0; i < 10; i++) {
        socket1.emit('trade_response', { accept: false });
        socket2.emit('trade_response', { accept: false });
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should receive match_result without manual simulate_match
      const matchResult = await waitForEvent<any>(socket1, 'match_result', 10000);
      expect(matchResult.homeScore).toBeGreaterThanOrEqual(0);

      const finalRoom = await waitForEvent<any>(socket1, 'room_updated');
      expect(finalRoom.phase).toBe('result');
    } finally {
      socket1.disconnect();
      socket2.disconnect();
    }
  }, 120000);

  it.fails('KNOWN BUG K4: non-room-member can trigger simulate_match', async () => {
    const socket1 = createSocket();
    const socket2 = createSocket();
    const outsider = createSocket();

    try {
      await Promise.all([
        new Promise(resolve => socket1.on('connect', resolve)),
        new Promise(resolve => socket2.on('connect', resolve)),
        new Promise(resolve => outsider.on('connect', resolve))
      ]);

      socket1.emit('create_room', { nick: 'P1', maxPlayers: 2, competition: 'Test' });
      const room = await waitForEvent<any>(socket1, 'room_updated');
      const roomId = room.id;

      socket2.emit('join_room', { room: roomId, nick: 'P2' });
      await waitForEvent<any>(socket2, 'room_updated');

      // Outsider never joined the room but emits simulate_match
      outsider.emit('simulate_match', { roomId });

      const response = await waitForEvent<any>(outsider, 'match_result').catch(() => null);

      // Should be rejected, not succeed
      expect(response).toBeNull();
    } finally {
      socket1.disconnect();
      socket2.disconnect();
      outsider.disconnect();
    }
  }, 30000);

  it('bot mode: 1 human + bot reaches match phase', async () => {
    const socket1 = createSocket();

    try {
      await new Promise(resolve => socket1.on('connect', resolve));

      socket1.emit('create_room', { nick: 'Human', maxPlayers: 2, competition: 'Test' });
      const room1 = await waitForEvent<any>(socket1, 'room_updated');

      socket1.emit('start_game');
      const tacticPhase = await waitForEvent<any>(socket1, 'room_updated');
      expect(tacticPhase.phase).toBe('tactic_selection');

      socket1.emit('select_tactic', { tactic: 'balanced', formation: '4-3-3' });
      const auctionPhase = await waitForEvent<any>(socket1, 'room_updated');
      expect(auctionPhase.phase).toBe('first_half_auction');

      let currentRoom = auctionPhase;
      const listener = (room: any) => { currentRoom = room; };
      socket1.on('room_updated', listener);

      // Skip through auction (bot should participate)
      for (let i = 0; i < 50; i++) {
        socket1.emit('skip_player');
        await new Promise(resolve => setTimeout(resolve, 200));
        if (currentRoom.phase !== 'first_half_auction') break;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      socket1.emit('finish_halftime');
      await new Promise(resolve => setTimeout(resolve, 1000));

      for (let i = 0; i < 50; i++) {
        socket1.emit('skip_player');
        await new Promise(resolve => setTimeout(resolve, 200));
        if (currentRoom.phase === 'steal') break;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Bot should have 11 players
      const botTeam = currentRoom.teams.find((t: any) => t.name.includes('Bot'));
      expect(botTeam).toBeDefined();
      expect(botTeam.roster).toHaveLength(11);

      socket1.emit('submit_steal', {
        target: botTeam.id,
        offer: currentRoom.teams[0].roster[0].id,
        protect: currentRoom.teams[0].roster[1].id
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      for (let i = 0; i < 10; i++) {
        socket1.emit('trade_response', { accept: false });
        await new Promise(resolve => setTimeout(resolve, 300));
        if (currentRoom.phase === 'match') break;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      expect(currentRoom.phase).toBe('match');

      // Workaround for K1
      socket1.emit('simulate_match');
      const matchResult = await waitForEvent<any>(socket1, 'match_result', 15000);

      expect(matchResult.homeScore).toBeGreaterThanOrEqual(0);
      expect(matchResult.awayScore).toBeGreaterThanOrEqual(0);

      const finalRoom = await waitForEvent<any>(socket1, 'room_updated');
      expect(finalRoom.phase).toBe('result');
    } finally {
      socket1.disconnect();
    }
  }, 120000);
});

describe('AMO ARENA integration', () => {
  it('creates room and second player joins', async () => {
    const socket1 = createSocket();
    const socket2 = createSocket();

    try {
      await Promise.all([
        new Promise(resolve => socket1.on('connect', resolve)),
        new Promise(resolve => socket2.on('connect', resolve))
      ]);

      socket1.emit('quiz_create_room', { nickname: 'Host', mode: 'solo' });
      const createResult = await waitForEvent<any>(socket1, 'quiz_room_created');
      expect(createResult.room.players).toHaveLength(1);

      const roomCode = createResult.room.id;

      socket2.emit('quiz_join_room', { roomId: roomCode, nickname: 'Player2' });

      const room1Update = await waitForEvent<any>(socket1, 'quiz_room_updated');
      const room2Update = await waitForEvent<any>(socket2, 'quiz_room_updated');

      expect(room1Update.players).toHaveLength(2);
      expect(room2Update.players).toHaveLength(2);
    } finally {
      socket1.disconnect();
      socket2.disconnect();
    }
  }, 30000);

  it.fails('KNOWN BUG K2: host cannot start game due to missing playerId', async () => {
    const socket1 = createSocket();
    const socket2 = createSocket();

    try {
      await Promise.all([
        new Promise(resolve => socket1.on('connect', resolve)),
        new Promise(resolve => socket2.on('connect', resolve))
      ]);

      socket1.emit('quiz_create_room', { nickname: 'Host', mode: 'solo' });
      const createResult = await waitForEvent<any>(socket1, 'quiz_room_created');
      const roomCode = createResult.room.id;

      socket2.emit('quiz_join_room', { roomId: roomCode, nickname: 'Player2' });
      await waitForEvent<any>(socket2, 'quiz_room_updated');

      // Host tries to start
      socket1.emit('quiz_start_game');

      const gameStarted1 = await waitForEvent<any>(socket1, 'quiz_game_started', 5000);
      const gameStarted2 = await waitForEvent<any>(socket2, 'quiz_game_started', 5000);

      expect(gameStarted1).toBeDefined();
      expect(gameStarted2).toBeDefined();
    } finally {
      socket1.disconnect();
      socket2.disconnect();
    }
  }, 30000);
});
