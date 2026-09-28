/** AMO ARENA lobby over Socket.IO, exactly as the real client sends it. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, connect, emitAck, waitFor, type TestServer } from './helpers';

let server: TestServer;
beforeAll(async () => { server = await startServer(3102); });
afterAll(async () => { await server?.stop(); });

describe('AMO ARENA lobby', () => {
  it('host creates a room, a second player joins, both see 2 players', async () => {
    const host = await connect(server.url);
    const guest = await connect(server.url);
    let hostView: any = null;
    let guestView: any = null;
    host.on('quiz_room_updated', (r: any) => (hostView = r));
    guest.on('quiz_room_updated', (r: any) => (guestView = r));
    try {
      const created = await emitAck<any>(host, 'quiz_create_room', { nickname: 'Host', mode: 'solo' });
      expect(created.success).toBe(true);
      expect(created.room.id).toMatch(/^[0-9A-F]{6}$/);
      expect(created.room.status).toBe('lobby');

      const joined = await emitAck<any>(guest, 'quiz_join_room', { roomId: created.room.id, nickname: 'Guest' });
      expect(joined.success).toBe(true);

      await waitFor(() => hostView?.players?.length === 2 && guestView?.players?.length === 2, 'both see 2 players', 3000,
        () => `host sees ${hostView?.players?.length}, guest sees ${guestView?.players?.length}`);
      expect(hostView.players.map((p: any) => p.nickname).sort()).toEqual(['Guest', 'Host']);
    } finally {
      host.close();
      guest.close();
    }
  });

  it('joining a room that does not exist is rejected', async () => {
    const s = await connect(server.url);
    try {
      const res = await emitAck<any>(s, 'quiz_join_room', { roomId: 'ZZZZZZ', nickname: 'Nobody' });
      expect(res.success).toBe(false);
    } finally {
      s.close();
    }
  });
});
