/**
 * K4 + K6 (fixed by the step that adds this file): 'simulate_match' must never let someone
 * end a game early, and must never crash the server.
 * Before the fix, anyone (even a socket outside the room) could send simulate_match at any
 * phase; on a room with only one team the match simulation then threw inside a timer and
 * killed the whole server (K6).
 * Now the match starts by itself after the trade phase (K1), so simulate_match must be
 * rejected: for outsiders always, and for members whenever the match is not waiting to start.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, connect, emitAck, sleep, waitFor, isHealthy, RoomTracker, setupBallOn, playToMatch, type TestServer } from './helpers';

let server: TestServer;
beforeAll(async () => { server = await startServer(3109); });
afterAll(async () => { await server?.stop(); });

/** A BALL-ON room that is still in the lobby (one team), with a member whose view we track. */
async function lobbyRoom() {
  const member = await connect(server.url);
  const tracker = new RoomTracker(member);
  const created = await emitAck<any>(member, 'create_room', { nickname: 'Alpha', maxPlayers: 2, competition: 'Test Cup' });
  expect(created.success).toBe(true);
  await waitFor(() => tracker.phase === 'lobby', 'lobby', 3000);
  return { member, tracker, roomId: created.roomId as string };
}

describe('simulate_match cannot end a game early or crash the server', () => {
  it('an outsider is rejected in the lobby; the lobby stays untouched and the server stays up', async () => {
    const { member, tracker, roomId } = await lobbyRoom();
    const outsider = await connect(server.url);
    try {
      const res = await emitAck<any>(outsider, 'simulate_match', { roomId });
      expect(res.success).toBe(false);
      await sleep(4000);
      expect(tracker.phase).toBe('lobby');
      expect(tracker.matchResults).toHaveLength(0);
      expect(await isHealthy(server.url)).toBe(true);
    } finally {
      outsider.close();
      member.close();
    }
  });

  it('K6: the room member is also rejected in a one-team lobby, and the server does NOT crash', async () => {
    const { member, tracker, roomId } = await lobbyRoom();
    try {
      const res = await emitAck<any>(member, 'simulate_match', { roomId });
      expect(res.success).toBe(false);
      await sleep(4000);
      expect(await isHealthy(server.url)).toBe(true);
      expect(server.proc.exitCode).toBeNull();
      expect(tracker.phase).toBe('lobby');
    } finally {
      member.close();
    }
  });

  it('a room member cannot end the game during the auction', async () => {
    const game = await setupBallOn(server.url, 2);
    try {
      const res = await emitAck<any>(game.sockets[0], 'simulate_match', { roomId: game.roomId });
      expect(res.success).toBe(false);
      await sleep(1000);
      expect(game.tracker.phase).toBe('first_half_auction');
      expect(game.tracker.matchResults).toHaveLength(0);
    } finally {
      game.close();
    }
  });

  it('during the match, simulate_match from an outsider or a member is rejected and there is still exactly one result', async () => {
    const game = await setupBallOn(server.url, 2);
    const outsider = await connect(server.url);
    try {
      await playToMatch(game);
      const fromOutsider = await emitAck<any>(outsider, 'simulate_match', { roomId: game.roomId });
      const fromMember = await emitAck<any>(game.sockets[1], 'simulate_match', { roomId: game.roomId });
      expect(fromOutsider.success).toBe(false);
      expect(fromMember.success).toBe(false);
      await game.tracker.waitForPhase('result', 8000);
      await sleep(4000);
      expect(game.tracker.matchResults).toHaveLength(1);
      expect(await isHealthy(server.url)).toBe(true);
    } finally {
      outsider.close();
      game.close();
    }
  });
});
