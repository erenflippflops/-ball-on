/**
 * Integration test helpers (auditor-written measurement tooling).
 *
 * Everything here talks to the REAL server (server/index.ts) over Socket.IO,
 * exactly like the browser client does. No game code is imported, so these
 * tests measure the server from the outside.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { io, type Socket } from 'socket.io-client';

const ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Server process
// ---------------------------------------------------------------------------

export interface TestServer {
  url: string;
  port: number;
  proc: ChildProcess;
  log: () => string;
  stop: () => Promise<void>;
}

export async function isHealthy(url: string, timeoutMs = 1000): Promise<boolean> {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Start server/index.ts on its own port and wait until /health answers. */
export async function startServer(port: number): Promise<TestServer> {
  const url = `http://127.0.0.1:${port}`;
  if (await isHealthy(url, 500)) {
    throw new Error(`Port ${port} is already in use by another server. Stop it and rerun.`);
  }
  let output = '';
  const proc = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'server/index.ts'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout?.on('data', (d) => (output += d.toString()));
  proc.stderr?.on('data', (d) => (output += d.toString()));

  const deadline = Date.now() + 20000;
  while (!(await isHealthy(url, 500))) {
    if (proc.exitCode !== null) throw new Error(`Server exited early (code ${proc.exitCode}):\n${output}`);
    if (Date.now() > deadline) {
      proc.kill();
      throw new Error(`Server on port ${port} did not become healthy within 20 s:\n${output}`);
    }
    await sleep(150);
  }

  return {
    url,
    port,
    proc,
    log: () => output,
    stop: async () => {
      if (proc.exitCode !== null || proc.killed) return;
      await new Promise<void>((resolve) => {
        proc.once('exit', () => resolve());
        if (process.platform === 'win32' && proc.pid) {
          // On Windows, kill the whole process tree (tsx starts a child node process).
          spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
        } else {
          proc.kill();
        }
        setTimeout(resolve, 3000);
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Sockets
// ---------------------------------------------------------------------------

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function connect(url: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(url, { transports: ['websocket'], reconnection: false, forceNew: true });
    const t = setTimeout(() => reject(new Error(`socket connect timeout to ${url}`)), 5000);
    s.once('connect', () => {
      clearTimeout(t);
      resolve(s);
    });
    s.once('connect_error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

/** Emit WITH an acknowledgement callback (the real client always does this). */
export function emitAck<T = any>(socket: Socket, event: string, payload: unknown, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`No ack for '${event}' within ${timeoutMs} ms`)), timeoutMs);
    socket.emit(event, payload, (res: T) => {
      clearTimeout(t);
      resolve(res);
    });
  });
}

/** Poll a condition every 50 ms. On timeout, the error message says what we were waiting for. */
export async function waitFor(check: () => boolean, label: string, timeoutMs: number, describe: () => string = () => ''): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out after ${timeoutMs} ms waiting for: ${label}. ${describe()}`);
    await sleep(50);
  }
}

// ---------------------------------------------------------------------------
// Room tracking (BALL-ON)
// ---------------------------------------------------------------------------

/**
 * Listens to 'room_updated' and 'match_result' from the moment it is created.
 * Create it right after connecting, BEFORE emitting anything.
 */
export class RoomTracker {
  room: any = null;
  phases: string[] = [];
  matchResults: any[] = [];

  constructor(socket: Socket) {
    socket.on('room_updated', (room: any) => {
      this.room = room;
      if (this.phases[this.phases.length - 1] !== room.phase) this.phases.push(room.phase);
    });
    socket.on('match_result', (result: any) => this.matchResults.push(result));
  }

  get phase(): string | undefined {
    return this.room?.phase;
  }

  describe(): string {
    if (!this.room) return 'No room_updated received yet.';
    const rosters = this.room.teams.map((t: any) => `${t.name}:${t.roster.length}`).join(', ');
    return `phase=${this.room.phase} currentPlayerIndex=${this.room.currentPlayerIndex} rosters=[${rosters}] phases so far=[${this.phases.join(' > ')}]`;
  }

  waitForPhase(phase: string, timeoutMs: number): Promise<void> {
    return waitFor(() => this.phase === phase, `phase '${phase}'`, timeoutMs, () => this.describe());
  }
}

// ---------------------------------------------------------------------------
// Position rules (written here on purpose, NOT imported from server code)
// Positions come from src/types.ts.
// ---------------------------------------------------------------------------

export const CATEGORY: Record<string, 'GK' | 'DEF' | 'MID' | 'ATT'> = {
  GK: 'GK',
  CB: 'DEF', LB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF',
  DM: 'MID', CM: 'MID', AM: 'MID', LM: 'MID', RM: 'MID',
  LW: 'ATT', RW: 'ATT', ST: 'ATT',
};

/** Limits the auction currently enforces for everyone (4-3-3; see known bug K3). */
export const AUCTION_LIMITS = { GK: 1, DEF: 4, MID: 3, ATT: 3 };

export function countCategories(roster: any[]) {
  const c = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  for (const p of roster) {
    const cat = CATEGORY[p.primaryPosition];
    if (!cat) throw new Error(`Unknown position '${p.primaryPosition}' for player ${p.name}`);
    c[cat]++;
  }
  return c;
}

/** Throws with a clear message if any team exceeds the auction limits. */
export function assertAuctionLimits(room: any, when: string): void {
  for (const team of room.teams) {
    const c = countCategories(team.roster);
    for (const k of Object.keys(AUCTION_LIMITS) as (keyof typeof AUCTION_LIMITS)[]) {
      if (c[k] > AUCTION_LIMITS[k]) {
        throw new Error(`Position limit broken ${when}: team ${team.name} has ${k}=${c[k]} (limit ${AUCTION_LIMITS[k]}). Counts: ${JSON.stringify(c)}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// BALL-ON game driver
// ---------------------------------------------------------------------------

export interface BallOnGame {
  roomId: string;
  sockets: Socket[];
  tracker: RoomTracker;
  soldChecks: number;
  bidsPlaced: number;
  close: () => void;
}

/** Create a room with `humans` real players (1 = bot mode) and move to the first auction. */
export async function setupBallOn(url: string, humans: 1 | 2): Promise<BallOnGame> {
  const sockets: Socket[] = [];
  for (let i = 0; i < humans; i++) sockets.push(await connect(url));
  const tracker = new RoomTracker(sockets[0]);
  const close = () => sockets.forEach((s) => s.close());

  const created = await emitAck<any>(sockets[0], 'create_room', { nickname: 'Alpha', maxPlayers: 2, competition: 'Test Cup' });
  if (!created?.success) throw new Error(`create_room failed: ${JSON.stringify(created)}`);
  const roomId: string = created.roomId;

  if (humans === 2) {
    const joined = await emitAck<any>(sockets[1], 'join_room', { roomId, nickname: 'Bravo' });
    if (!joined?.success) throw new Error(`join_room failed: ${JSON.stringify(joined)}`);
  }

  const started = await emitAck<any>(sockets[0], 'start_game', { roomId });
  if (!started?.success) throw new Error(`start_game failed: ${JSON.stringify(started)}`);
  await tracker.waitForPhase('tactic_selection', 3000);

  for (const s of sockets) {
    const res = await emitAck<any>(s, 'select_tactic', { roomId, tacticId: 'tiki-taka', formation: '4-3-3' });
    if (!res?.success) throw new Error(`select_tactic failed: ${JSON.stringify(res)}`);
  }
  // The server starts the auction about 2.5 s after the last selection.
  await tracker.waitForPhase('first_half_auction', 8000);

  return { roomId, sockets, tracker, soldChecks: 0, bidsPlaced: 0, close };
}

/**
 * How often player 0 bids 1 CR.
 * - 'every5': on every 5th player (2-human games: the other human skips, so the sale is immediate).
 * - 'once':   only on the first possible player of the whole game (bot games, see below).
 */
export type BidPolicy = 'every5' | 'once';

/**
 * Drive one auction half until the phase changes.
 * Player 0 bids 1 CR according to the bid policy; if the server rejects the bid, player 0 skips
 * instead (a rejected bid does NOT count as a decision, so without the skip the server waits 14 s).
 * Everyone else skips. After every step the position limits are checked.
 *
 * Timing facts from server/index.ts:
 * - When a human skips, bots are forced to decide at once, so the sale is immediate.
 * - When a human BIDS, a bot that wants the player bids 2-7 s later. With two bidders the sale
 *   only ends when the 14 s timer runs out (+3 s if a bid arrives in the last 5 s).
 *   So after a successful bid we wait up to 20 s instead of 4 s.
 */
export async function driveAuction(game: BallOnGame, phase: 'first_half_auction' | 'second_half_auction', policy: BidPolicy = 'every5', maxSteps = 120): Promise<void> {
  const { tracker, sockets, roomId } = game;
  let step = 0;
  while (tracker.phase === phase) {
    if (++step > maxSteps) throw new Error(`Auction did not finish within ${maxSteps} players. ${tracker.describe()}`);
    const index = tracker.room.currentPlayerIndex;

    const wantBid = policy === 'every5' ? step % 5 === 0 : game.bidsPlaced === 0;
    let bidPlaced = false;
    for (let i = 0; i < sockets.length; i++) {
      let decided = false;
      if (i === 0 && wantBid) {
        const bid = await emitAck<any>(sockets[i], 'place_bid', { roomId, amount: 1 });
        decided = !!bid?.success;
        if (decided) { bidPlaced = true; game.bidsPlaced++; }
      }
      if (!decided) await emitAck<any>(sockets[i], 'skip_player', { roomId });
    }

    await waitFor(
      () => tracker.room.currentPlayerIndex !== index || tracker.phase !== phase,
      `next player after index ${index}${bidPlaced ? ' (after a bid)' : ''}`,
      bidPlaced ? 20000 : 4000,
      () => tracker.describe(),
    );
    assertAuctionLimits(tracker.room, `after player index ${index} (${phase})`);
    game.soldChecks++;
  }
}

/** Full BALL-ON flow from the first auction to the 'match' phase. */
export async function playToMatch(game: BallOnGame): Promise<{ roomAtSteal: any }> {
  const { tracker, sockets, roomId } = game;
  // Bot games: bid only once, because a bot counter-bid means waiting for the 14 s timer.
  const policy: BidPolicy = sockets.length === 1 ? 'once' : 'every5';

  await driveAuction(game, 'first_half_auction', policy);
  await tracker.waitForPhase('halftime', 3000);

  const ht = await emitAck<any>(sockets[0], 'finish_halftime', { roomId });
  if (!ht?.success) throw new Error(`finish_halftime failed: ${JSON.stringify(ht)}`);
  await tracker.waitForPhase('second_half_auction', 3000);

  await driveAuction(game, 'second_half_auction', policy);
  await tracker.waitForPhase('steal', 3000);
  const roomAtSteal = structuredClone(tracker.room);

  for (const s of sockets) {
    const me = tracker.room.teams.find((t: any) => t.id === s.id);
    const opponent = tracker.room.teams.find((t: any) => t.id !== s.id);
    if (!me || !opponent) throw new Error(`Could not find own/opponent team for socket ${s.id}. ${tracker.describe()}`);
    const res = await emitAck<any>(s, 'submit_steal', {
      roomId,
      target: opponent.roster[0].id,
      offer: me.roster[1].id,
      protect: me.roster[2].id,
    });
    if (!res?.success) throw new Error(`submit_steal failed: ${JSON.stringify(res)}`);
  }
  await tracker.waitForPhase('trade', 3000);

  for (const s of sockets) {
    const res = await emitAck<any>(s, 'trade_response', { roomId, accept: false });
    if (!res?.success) throw new Error(`trade_response failed: ${JSON.stringify(res)}`);
  }
  await tracker.waitForPhase('match', 3000);

  return { roomAtSteal };
}

export const EXPECTED_PHASES = [
  'lobby',
  'tactic_selection',
  'first_half_auction',
  'halftime',
  'second_half_auction',
  'steal',
  'trade',
  'match',
];
