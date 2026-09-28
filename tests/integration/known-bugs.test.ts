/**
 * Known bugs K1, K2, K4. Each bug has TWO tests:
 *  1. "(current symptom)": a NORMAL test that asserts today's exact buggy behavior.
 *     It proves the bug is real and that the second test fails for the RIGHT reason.
 *  2. "(correct behavior)": it.fails, asserting what the game SHOULD do.
 * When a bug gets fixed, BOTH tests turn red. That is the signal to update this file:
 * delete the symptom test and turn it.fails into a normal it().
 * K3 lives in tests/unit/positionLimits.test.ts, K5 in k5-server-crash.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, setupBallOn, playToMatch, connect, emitAck, sleep, waitFor, type TestServer } from './helpers';

let server: TestServer;
beforeAll(async () => { server = await startServer(3103); });
afterAll(async () => { await server?.stop(); });

describe('K1: the match never starts by itself', () => {
  it('KNOWN BUG K1 (current symptom): phase stays "match" and no match_result arrives within 3 s', async () => {
    const game = await setupBallOn(server.url, 2);
    try {
      await playToMatch(game);
      await sleep(3000);
      expect(game.tracker.phase).toBe('match');
      expect(game.tracker.matchResults).toHaveLength(0);
    } finally {
      game.close();
    }
  });

  it.fails('KNOWN BUG K1 (correct behavior): match_result arrives by itself within 10 s and phase becomes "result"', async () => {
    const game = await setupBallOn(server.url, 2);
    try {
      await playToMatch(game);
      await game.tracker.waitForPhase('result', 10000);
      expect(game.tracker.matchResults).toHaveLength(1);
    } finally {
      game.close();
    }
  });
});

describe('K4: a socket outside the room can start that room\'s match', () => {
  it('KNOWN BUG K4 (current symptom): outsider gets {success:true} and the room goes to "result"', async () => {
    const game = await setupBallOn(server.url, 2);
    const outsider = await connect(server.url);
    try {
      await playToMatch(game);
      const res = await emitAck<any>(outsider, 'simulate_match', { roomId: game.roomId });
      expect(res).toEqual({ success: true });
      await game.tracker.waitForPhase('result', 3000);
      expect(game.tracker.matchResults).toHaveLength(1);
    } finally {
      outsider.close();
      game.close();
    }
  });

  it.fails('KNOWN BUG K4 (correct behavior): outsider is rejected and the room stays in "match"', async () => {
    const game = await setupBallOn(server.url, 2);
    const outsider = await connect(server.url);
    try {
      await playToMatch(game);
      const res = await emitAck<any>(outsider, 'simulate_match', { roomId: game.roomId });
      expect(res.success).toBe(false);
      await sleep(1000);
      expect(game.tracker.phase).toBe('match');
      expect(game.tracker.matchResults).toHaveLength(0);
    } finally {
      outsider.close();
      game.close();
    }
  });
});

/** Creates an AMO ARENA room with 2 players, sending exactly what the real client sends. */
async function amoRoomWithTwoPlayers() {
  const host = await connect(server.url);
  const guest = await connect(server.url);
  const started = { host: false, guest: false };
  host.on('quiz_game_started', () => (started.host = true));
  guest.on('quiz_game_started', () => (started.guest = true));
  const created = await emitAck<any>(host, 'quiz_create_room', { nickname: 'Host', mode: 'solo' });
  expect(created.success).toBe(true);
  const joined = await emitAck<any>(guest, 'quiz_join_room', { roomId: created.room.id, nickname: 'Guest' });
  expect(joined.success).toBe(true);
  return { host, guest, roomId: created.room.id as string, started, close: () => { host.close(); guest.close(); } };
}

describe('K2: the AMO ARENA host cannot start the game', () => {
  it('KNOWN BUG K2 (current symptom): quiz_start_game {roomId} is rejected with "Yalnızca host oyunu başlatabilir"', async () => {
    const amo = await amoRoomWithTwoPlayers();
    try {
      // src/amo-arena-main.tsx sends only { roomId }, no playerId.
      const res = await emitAck<any>(amo.host, 'quiz_start_game', { roomId: amo.roomId });
      expect(res).toEqual({ success: false, error: 'Yalnızca host oyunu başlatabilir' });
      await sleep(500);
      expect(amo.started).toEqual({ host: false, guest: false });
    } finally {
      amo.close();
    }
  });

  it.fails('KNOWN BUG K2 (correct behavior): host start succeeds and both players receive quiz_game_started', async () => {
    const amo = await amoRoomWithTwoPlayers();
    try {
      const res = await emitAck<any>(amo.host, 'quiz_start_game', { roomId: amo.roomId });
      expect(res.success).toBe(true);
      await waitFor(() => amo.started.host && amo.started.guest, 'both receive quiz_game_started', 3000);
    } finally {
      amo.close();
    }
  });
});
