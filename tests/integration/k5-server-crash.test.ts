import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { io, Socket } from 'socket.io-client';

const PORT = 3103;
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

describe('Known Bug K5', () => {
  it('KNOWN BUG K5 (current symptom): emitting create_room without callback crashes server', async () => {
    const socket = createSocket();

    try {
      await new Promise(resolve => socket.on('connect', resolve));

      // Emit without callback - current symptom: crashes server
      socket.emit('create_room', { nickname: 'Test', maxPlayers: 2, competition: 'Test' });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Server should have crashed - health check fails
      try {
        const response = await fetch(`${SERVER_URL}/health`);
        expect(response.ok).toBe(false);
      } catch (e) {
        // Expected: connection refused because server crashed
        expect(e).toBeDefined();
      }
    } finally {
      socket.disconnect();
    }
  }, 30000);

  it.fails('KNOWN BUG K5 (correct behavior): server stays up after ack-less emit', async () => {
    const socket = createSocket();

    try {
      await new Promise(resolve => socket.on('connect', resolve));

      // Emit without callback
      socket.emit('create_room', { nickname: 'Test', maxPlayers: 2, competition: 'Test' });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Correct behavior: server stays up
      const response = await fetch(`${SERVER_URL}/health`);
      expect(response.ok).toBe(true);

      // Other rooms still work
      const socket2 = createSocket();
      await new Promise(resolve => socket2.on('connect', resolve));

      const canCreateRoom = await new Promise((resolve) => {
        socket2.emit('create_room', { nickname: 'Test2', maxPlayers: 2, competition: 'Test' }, (res: any) => {
          resolve(res.success === true);
        });
        setTimeout(() => resolve(false), 3000);
      });

      expect(canCreateRoom).toBe(true);
      socket2.disconnect();
    } finally {
      socket.disconnect();
    }
  }, 30000);
});
