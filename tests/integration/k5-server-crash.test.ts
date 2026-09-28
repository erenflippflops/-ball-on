/**
 * K5 (CRITICAL): a single event sent WITHOUT an acknowledgement callback crashes the whole
 * server ("TypeError: callback is not a function"), which takes down both games and all rooms.
 * These tests kill the server on purpose, so every test starts its OWN server on its own port.
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
  it('KNOWN BUG K5 (current symptom, BALL-ON event): server process dies after create_room without ack', async () => {
    const r = await sendWithoutAck(3104, 'create_room', { nickname: 'X', maxPlayers: 2, competition: 'Test' });
    expect(r.healthy).toBe(false);
    expect(r.exitCode).not.toBeNull();
    expect(r.log).toContain('callback is not a function');
  });

  it('KNOWN BUG K5 (current symptom, AMO ARENA event): server process dies after quiz_create_room without ack', async () => {
    const r = await sendWithoutAck(3105, 'quiz_create_room', { nickname: 'X', mode: 'solo' });
    expect(r.healthy).toBe(false);
    expect(r.exitCode).not.toBeNull();
    expect(r.log).toContain('callback is not a function');
  });

  it.fails('KNOWN BUG K5 (correct behavior): server stays up after create_room without ack', async () => {
    const r = await sendWithoutAck(3106, 'create_room', { nickname: 'X', maxPlayers: 2, competition: 'Test' });
    expect(r.healthy).toBe(true);
  });

  it.fails('KNOWN BUG K5 (correct behavior): server stays up after quiz_create_room without ack', async () => {
    const r = await sendWithoutAck(3107, 'quiz_create_room', { nickname: 'X', mode: 'solo' });
    expect(r.healthy).toBe(true);
  });
});
