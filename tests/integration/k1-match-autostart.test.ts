/**
 * K1 (fixed by the step that adds this file): after every team has answered the trade offer,
 * the server must start the match BY ITSELF and send exactly ONE result.
 * Nobody sends 'simulate_match' in these tests.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, setupBallOn, playToMatch, emitAck, sleep, type TestServer } from './helpers';

let server: TestServer;
beforeAll(async () => { server = await startServer(3108); });
afterAll(async () => { await server?.stop(); });

describe('K1: the match starts by itself after the trade phase', () => {
  it('match -> result within 8 s, exactly one match_result, and no second one afterwards', async () => {
    const game = await setupBallOn(server.url, 2);
    try {
      await playToMatch(game);
      await game.tracker.waitForPhase('result', 8000);
      expect(game.tracker.matchResults).toHaveLength(1);
      // Make sure no duplicate match is played later.
      await sleep(4000);
      expect(game.tracker.matchResults).toHaveLength(1);
      expect(game.tracker.phase).toBe('result');
    } finally {
      game.close();
    }
  });

  it('a repeated trade_response (double click) does not start a second match or leave "result"', async () => {
    const game = await setupBallOn(server.url, 2);
    try {
      await playToMatch(game);
      // Both players click the trade button again while the match is running.
      for (const s of game.sockets) await emitAck(s, 'trade_response', { roomId: game.roomId, accept: false });
      await game.tracker.waitForPhase('result', 8000);
      // ...and once more after the result is shown.
      for (const s of game.sockets) await emitAck(s, 'trade_response', { roomId: game.roomId, accept: false });
      await sleep(4500);
      expect(game.tracker.matchResults).toHaveLength(1);
      expect(game.tracker.phase).toBe('result');
    } finally {
      game.close();
    }
  });
});
