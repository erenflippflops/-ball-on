/**
 * K5 is FIXED: the server no longer crashes when an event is sent without an ack callback.
 * The wrapper guards all socket handlers, catching errors and ensuring a callback exists.
 */
import { describe, it, expect } from 'vitest';
import { startServer, connect, isHealthy, sleep, type TestServer } from './helpers';

async function sendWithoutAck(port: number, event: string, payload: unknown) {
  const server: TestServer = await startServer(port);
  const s = await connect(server.url);
  try {
    s.emit(event, payload); // no callback, on purpose
    await sleep(1500);
    return { healthy: await isHealthy(server.url, 1000), exitCode: server.proc.exitCode, log: server.log() };
  } finally {
    s.close();
    await server.stop();
  }
}

describe('K5: an event without ack callback crashes the server', () => {
  it('K5 fixed: server stays up after create_room without ack', async () => {
    const r = await sendWithoutAck(3106, 'create_room', { nickname: 'X', maxPlayers: 2, competition: 'Test' });
    expect(r.healthy).toBe(true);
  });

  it('K5 fixed: server stays up after quiz_create_room without ack', async () => {
    const r = await sendWithoutAck(3107, 'quiz_create_room', { nickname: 'X', mode: 'solo' });
    expect(r.healthy).toBe(true);
  });
});
