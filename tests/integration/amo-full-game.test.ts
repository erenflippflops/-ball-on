/**
 * AMO ARENA must be playable from start to finish (fixes known bug K2 and the round-timeout bug).
 *
 * The real client (src/amo-arena-main.tsx) NEVER sends a playerId: it sends only
 * { roomId } / { roomId, answer }. So the server must remember which quiz player each socket is
 * (set when the socket creates or joins a room) and must IGNORE any playerId sent by a client.
 *
 * GAME_TIME_SCALE: an optional server setting (default 1). Question time limits are multiplied
 * by it. Tests use 0.1 so a 40 s question lasts 4 s. Players never see it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Socket } from 'socket.io-client';
import { startServer, connect, emitAck, waitFor, sleep, type TestServer } from './helpers';

interface Player { socket: Socket; playerId: string; started: any[]; roundResults: any[]; finished: any[] }

function track(socket: Socket, playerId: string): Player {
  const p: Player = { socket, playerId, started: [], roundResults: [], finished: [] };
  socket.on('quiz_game_started', (d: any) => p.started.push(d));
  socket.on('quiz_round_result', (d: any) => p.roundResults.push(d));
  socket.on('quiz_game_finished', (d: any) => p.finished.push(d));
  return p;
}

/** Host + guest in one lobby, exactly as the real client does it. */
async function twoPlayerRoom(url: string) {
  const hostSocket = await connect(url);
  const guestSocket = await connect(url);
  const created = await emitAck<any>(hostSocket, 'quiz_create_room', { nickname: 'Host', mode: 'solo' });
  expect(created.success).toBe(true);
  const joined = await emitAck<any>(guestSocket, 'quiz_join_room', { roomId: created.room.id, nickname: 'Guest' });
  expect(joined.success).toBe(true);
  return {
    roomId: created.room.id as string,
    host: track(hostSocket, created.playerId),
    guest: track(guestSocket, joined.playerId),
    close: () => { hostSocket.close(); guestSocket.close(); },
  };
}

describe('AMO ARENA identity and full game (normal speed)', () => {
  let server: TestServer;
  beforeAll(async () => { server = await startServer(3110); });
  afterAll(async () => { await server?.stop(); });

  it('the host starts with { roomId } only, and both players receive quiz_game_started', async () => {
    const g = await twoPlayerRoom(server.url);
    try {
      const res = await emitAck<any>(g.host.socket, 'quiz_start_game', { roomId: g.roomId });
      expect(res.success).toBe(true);
      await waitFor(() => g.host.started.length === 1 && g.guest.started.length === 1, 'both receive quiz_game_started', 3000);
      expect(g.host.started[0].currentRound).toBe(1);
    } finally {
      g.close();
    }
  });

  it('the guest cannot start the game, not even by sending the host\'s playerId', async () => {
    const g = await twoPlayerRoom(server.url);
    try {
      const plain = await emitAck<any>(g.guest.socket, 'quiz_start_game', { roomId: g.roomId });
      expect(plain).toEqual({ success: false, error: 'Yalnızca host oyunu başlatabilir' });
      const forged = await emitAck<any>(g.guest.socket, 'quiz_start_game', { roomId: g.roomId, playerId: g.host.playerId });
      expect(forged).toEqual({ success: false, error: 'Yalnızca host oyunu başlatabilir' });
      await sleep(300);
      expect(g.host.started).toHaveLength(0);
    } finally {
      g.close();
    }
  });

  it('a full 10-round game: both answer every round, host moves on, the game finishes with both players ranked', async () => {
    const g = await twoPlayerRoom(server.url);
    try {
      expect((await emitAck<any>(g.host.socket, 'quiz_start_game', { roomId: g.roomId })).success).toBe(true);
      for (let round = 1; round <= 10; round++) {
        await waitFor(() => g.guest.started.length === round, `round ${round} started`, 3000);
        // An answer is recorded for the right player even though no playerId is sent.
        const a1 = await emitAck<any>(g.host.socket, 'quiz_submit_answer', { roomId: g.roomId, answer: null });
        expect(a1.success, `host answer round ${round}: ${a1.error}`).toBe(true);
        // The same player cannot answer twice (checked while the round is still open).
        const again = await emitAck<any>(g.host.socket, 'quiz_submit_answer', { roomId: g.roomId, answer: null });
        expect(again).toEqual({ success: false, error: 'Cevabın zaten gönderildi' });
        const a2 = await emitAck<any>(g.guest.socket, 'quiz_submit_answer', { roomId: g.roomId, answer: null });
        expect(a2.success, `guest answer round ${round}: ${a2.error}`).toBe(true);
        await waitFor(() => g.host.roundResults.length === round && g.guest.roundResults.length === round, `round ${round} result`, 3000);
        const guestNext = await emitAck<any>(g.guest.socket, 'quiz_next_round', { roomId: g.roomId });
        expect(guestNext.success, 'only the host may go to the next round').toBe(false);
        const next = await emitAck<any>(g.host.socket, 'quiz_next_round', { roomId: g.roomId });
        expect(next.success, `next round after ${round}: ${next.error}`).toBe(true);
        if (round === 10) expect(next.finished).toBe(true);
      }
      await waitFor(() => g.host.finished.length === 1 && g.guest.finished.length === 1, 'quiz_game_finished for both', 3000);
      const rankings = g.guest.finished[0].finalRankings;
      expect(rankings.map((r: any) => r.name).sort()).toEqual(['Guest', 'Host']);
      expect(g.host.roundResults).toHaveLength(10);
    } finally {
      g.close();
    }
  });
});

describe('AMO ARENA round timeout (GAME_TIME_SCALE=0.1)', () => {
  let server: TestServer;
  beforeAll(async () => { server = await startServer(3111, { GAME_TIME_SCALE: '0.1' }); });
  afterAll(async () => { await server?.stop(); });

  it('if a player never answers, the round ends by itself when the time is up', async () => {
    const g = await twoPlayerRoom(server.url);
    try {
      expect((await emitAck<any>(g.host.socket, 'quiz_start_game', { roomId: g.roomId })).success).toBe(true);
      await waitFor(() => g.host.started.length === 1, 'round 1 started', 3000);
      const q = g.host.started[0].question;
      const scaledMs = q.time_limit * 1000 * 0.1;
      // The deadline the server reports must use the scaled time.
      const d = g.host.started[0];
      expect(d.deadline - d.serverNow).toBeGreaterThanOrEqual(scaledMs - 50);
      expect(d.deadline - d.serverNow).toBeLessThanOrEqual(scaledMs + 50);

      expect((await emitAck<any>(g.host.socket, 'quiz_submit_answer', { roomId: g.roomId, answer: null })).success).toBe(true);
      // The guest stays silent. The round must end within the scaled limit + 3 s.
      await waitFor(() => g.host.roundResults.length === 1 && g.guest.roundResults.length === 1,
        'round result after timeout', scaledMs + 3000);

      // A late answer after the round ended is rejected, and the host can continue.
      const late = await emitAck<any>(g.guest.socket, 'quiz_submit_answer', { roomId: g.roomId, answer: null });
      expect(late.success).toBe(false);
      const next = await emitAck<any>(g.host.socket, 'quiz_next_round', { roomId: g.roomId });
      expect(next.success).toBe(true);
      await waitFor(() => g.guest.started.length === 2, 'round 2 started', 3000);
      // Only ONE result for round 1 (the timer must not fire a second time).
      await sleep(500);
      expect(g.host.roundResults).toHaveLength(1);
    } finally {
      g.close();
    }
  });
  it('when everyone answers early, the old round timer must NOT end the next round early', async () => {
    const g = await twoPlayerRoom(server.url);
    try {
      expect((await emitAck<any>(g.host.socket, 'quiz_start_game', { roomId: g.roomId })).success).toBe(true);
      await waitFor(() => g.host.started.length === 1, 'round 1 started', 3000);
      // Round 1: both answer at once, so the round ends long before its timer.
      await emitAck<any>(g.host.socket, 'quiz_submit_answer', { roomId: g.roomId, answer: null });
      await emitAck<any>(g.guest.socket, 'quiz_submit_answer', { roomId: g.roomId, answer: null });
      await waitFor(() => g.host.roundResults.length === 1, 'round 1 result', 3000);
      expect((await emitAck<any>(g.host.socket, 'quiz_next_round', { roomId: g.roomId })).success).toBe(true);
      await waitFor(() => g.host.started.length === 2, 'round 2 started', 3000);
      const round2 = g.host.started[1];
      // Round 2: nobody answers. Its result may only come at ITS deadline, not earlier.
      await waitFor(() => g.host.roundResults.length === 2, 'round 2 result', round2.deadline - Date.now() + 3000);
      const arrivedAt = Date.now();
      expect(arrivedAt, 'round 2 ended before its own deadline').toBeGreaterThanOrEqual(round2.deadline - 150);
      expect(g.host.roundResults[1].round).toBe(2);
    } finally {
      g.close();
    }
  });
});
