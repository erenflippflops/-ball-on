/**
 * F1: Rooms of 2-8 players specification tests.
 * These tests define the REQUIRED behavior. The builder will implement F1 against these tests.
 *
 * Rules tested:
 * 1. create_room accepts maxPlayers 2-8; rejects 1, 9, 0, non-integers, missing
 * 2. start_game fills empty seats with bots; bot names are unique
 * 3. Halftime starts when total rosters reach floor(teams*11/2)
 * 4. Bot decision speed: 1-3s (100-300ms scaled at 0.1)
 * 5. GAME_TIME_SCALE scales all BALL-ON timers
 *    5b. BALLON_HALF_SECONDS controls auction half length
 * 6. Pool exhaustion: every team gets exactly 11, no duplicates, position limits respected
 *    6b. Free fill also happens when second half ends by timer with teams below 11
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startServer,
  connect,
  emitAck,
  waitFor,
  sleep,
  RoomTracker,
  countCategories,
  AUCTION_LIMITS,
  type TestServer,
  type Socket,
} from './helpers';

// ---------------------------------------------------------------------------
// Rule 1: create_room validation
// ---------------------------------------------------------------------------

describe('F1 Rule 1: create_room maxPlayers validation', () => {
  let server: TestServer;
  beforeAll(async () => { server = await startServer(3112); });
  afterAll(async () => { await server?.stop(); });

  for (const n of [2, 3, 4, 5, 6, 7, 8]) {
    it(`accepts maxPlayers=${n} and room.maxPlayers === ${n}`, async () => {
      const s = await connect(server.url);
      try {
        const res = await emitAck<any>(s, 'create_room', { nickname: 'Test', maxPlayers: n, competition: 'F1' });
        expect(res.success, `create_room with maxPlayers=${n} should succeed`).toBe(true);
        expect(res.roomId, `roomId should be defined for maxPlayers=${n}`).toBeDefined();
        expect(res.room?.maxPlayers, `room.maxPlayers should be ${n}`).toBe(n);
      } finally {
        s.close();
      }
    });
  }

  it('rejects maxPlayers=1', async () => {
    const s = await connect(server.url);
    try {
      const res = await emitAck<any>(s, 'create_room', { nickname: 'Test', maxPlayers: 1, competition: 'F1' });
      expect(res.success).toBe(false);
      expect(res.error, 'error message should be in Turkish').toBeDefined();
      expect(typeof res.error).toBe('string');
      expect(res.roomId).toBeUndefined();
    } finally {
      s.close();
    }
  });

  it('rejects maxPlayers=9', async () => {
    const s = await connect(server.url);
    try {
      const res = await emitAck<any>(s, 'create_room', { nickname: 'Test', maxPlayers: 9, competition: 'F1' });
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
      expect(res.roomId).toBeUndefined();
    } finally {
      s.close();
    }
  });

  it('rejects maxPlayers=0', async () => {
    const s = await connect(server.url);
    try {
      const res = await emitAck<any>(s, 'create_room', { nickname: 'Test', maxPlayers: 0, competition: 'F1' });
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
      expect(res.roomId).toBeUndefined();
    } finally {
      s.close();
    }
  });

  it('rejects maxPlayers=4.5 (non-integer)', async () => {
    const s = await connect(server.url);
    try {
      const res = await emitAck<any>(s, 'create_room', { nickname: 'Test', maxPlayers: 4.5, competition: 'F1' });
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
      expect(res.roomId).toBeUndefined();
    } finally {
      s.close();
    }
  });

  it('rejects maxPlayers="4" (string)', async () => {
    const s = await connect(server.url);
    try {
      const res = await emitAck<any>(s, 'create_room', { nickname: 'Test', maxPlayers: '4' as any, competition: 'F1' });
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
      expect(res.roomId).toBeUndefined();
    } finally {
      s.close();
    }
  });

  it('rejects missing maxPlayers', async () => {
    const s = await connect(server.url);
    try {
      const res = await emitAck<any>(s, 'create_room', { nickname: 'Test', competition: 'F1' });
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
      expect(res.roomId).toBeUndefined();
    } finally {
      s.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Rule 2: Bots fill empty seats
// ---------------------------------------------------------------------------

describe('F1 Rule 2: bots fill empty seats', () => {
  let server: TestServer;
  beforeAll(async () => { server = await startServer(3113); });
  afterAll(async () => { await server?.stop(); });

  it('3 players: 1 human + 2 bots with unique names', async () => {
    const s = await connect(server.url);
    const tracker = new RoomTracker(s);
    try {
      const created = await emitAck<any>(s, 'create_room', { nickname: 'Human', maxPlayers: 3, competition: 'F1' });
      expect(created.success).toBe(true);
      const started = await emitAck<any>(s, 'start_game', { roomId: created.roomId });
      expect(started.success).toBe(true);
      await tracker.waitForPhase('tactic_selection', 3000);

      expect(tracker.room.teams, 'should have 3 teams').toHaveLength(3);
      const bots = tracker.room.teams.filter((t: any) => t.id.startsWith('bot'));
      expect(bots, 'should have 2 bot teams').toHaveLength(2);
      const botNames = bots.map((t: any) => t.name);
      expect(new Set(botNames).size, 'bot names must be unique').toBe(2);
    } finally {
      s.close();
    }
  });

  it('5 players: 1 human + 4 bots with unique names', async () => {
    const s = await connect(server.url);
    const tracker = new RoomTracker(s);
    try {
      const created = await emitAck<any>(s, 'create_room', { nickname: 'Human', maxPlayers: 5, competition: 'F1' });
      expect(created.success).toBe(true);
      const started = await emitAck<any>(s, 'start_game', { roomId: created.roomId });
      expect(started.success).toBe(true);
      await tracker.waitForPhase('tactic_selection', 3000);

      expect(tracker.room.teams).toHaveLength(5);
      const bots = tracker.room.teams.filter((t: any) => t.id.startsWith('bot'));
      expect(bots).toHaveLength(4);
      const botNames = bots.map((t: any) => t.name);
      expect(new Set(botNames).size).toBe(4);
    } finally {
      s.close();
    }
  });

  it('8 players: 1 human + 7 bots with unique names', async () => {
    const s = await connect(server.url);
    const tracker = new RoomTracker(s);
    try {
      const created = await emitAck<any>(s, 'create_room', { nickname: 'Human', maxPlayers: 8, competition: 'F1' });
      expect(created.success).toBe(true);
      const started = await emitAck<any>(s, 'start_game', { roomId: created.roomId });
      expect(started.success).toBe(true);
      await tracker.waitForPhase('tactic_selection', 3000);

      expect(tracker.room.teams).toHaveLength(8);
      const bots = tracker.room.teams.filter((t: any) => t.id.startsWith('bot'));
      expect(bots).toHaveLength(7);
      const botNames = bots.map((t: any) => t.name);
      expect(new Set(botNames).size).toBe(7);
    } finally {
      s.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Rule 3: Halftime at floor(teams*11/2)
// ---------------------------------------------------------------------------

describe('F1 Rule 3: halftime at floor(teams*11/2)', () => {
  let server: TestServer;
  beforeAll(async () => { server = await startServer(3114, { GAME_TIME_SCALE: '0.1', BALLON_HALF_SECONDS: '3600' }); });
  afterAll(async () => { await server?.stop(); });

  async function testHalftimeThreshold(maxPlayers: number, expectedHalfAt: number) {
    const s = await connect(server.url);
    const tracker = new RoomTracker(s);
    const rosterHistory: number[] = [];

    s.on('room_updated', (room: any) => {
      if (room.phase === 'first_half_auction') {
        const total = room.teams.reduce((sum: number, t: any) => sum + t.roster.length, 0);
        rosterHistory.push(total);
      }
    });

    try {
      const created = await emitAck<any>(s, 'create_room', { nickname: 'H', maxPlayers, competition: 'F1' });
      expect(created.success).toBe(true);
      const roomId = created.roomId;

      const started = await emitAck<any>(s, 'start_game', { roomId });
      expect(started.success).toBe(true);
      await tracker.waitForPhase('tactic_selection', 3000);

      await emitAck<any>(s, 'select_tactic', { roomId, tacticId: 'tiki-taka', formation: '4-3-3' });
      await tracker.waitForPhase('first_half_auction', 8000);

      let step = 0;
      const maxSteps = 200;
      while (tracker.phase === 'first_half_auction') {
        if (++step > maxSteps) throw new Error(`Did not reach halftime within ${maxSteps} steps for maxPlayers=${maxPlayers}. ${tracker.describe()}`);

        const wantBid = step % 5 === 0;
        if (wantBid) {
          const bid = await emitAck<any>(s, 'place_bid', { roomId, amount: 1 });
          if (!bid?.success) {
            await emitAck<any>(s, 'skip_player', { roomId });
          }
        } else {
          await emitAck<any>(s, 'skip_player', { roomId });
        }

        await waitFor(
          () => tracker.phase !== 'first_half_auction',
          `phase change from first_half_auction`,
          20000,
          () => tracker.describe(),
        );
        if (tracker.phase !== 'first_half_auction') break;
      }

      await tracker.waitForPhase('halftime', 2000);

      // Check: total roster never exceeded expectedHalfAt during first_half_auction
      for (const total of rosterHistory) {
        expect(total, `total roster during first_half_auction must not exceed ${expectedHalfAt}`).toBeLessThanOrEqual(expectedHalfAt);
      }

      // Check: final total roster equals expectedHalfAt exactly
      const finalTotal = tracker.room.teams.reduce((sum: number, t: any) => sum + t.roster.length, 0);
      expect(finalTotal, `halftime should start exactly at ${expectedHalfAt} total roster`).toBe(expectedHalfAt);
    } finally {
      s.close();
    }
  }

  it('2 teams: halftime at 11 total roster (floor(2*11/2)=11)', async () => {
    await testHalftimeThreshold(2, 11);
  }, 60000);

  it('5 teams: halftime at 27 total roster (floor(5*11/2)=27)', async () => {
    await testHalftimeThreshold(5, 27);
  }, 60000);
});

// ---------------------------------------------------------------------------
// Rule 4: Bot decision speed (1-3s real time)
// ---------------------------------------------------------------------------

describe('F1 Rule 4: bot decision speed', () => {
  let server: TestServer;
  beforeAll(async () => { server = await startServer(3115, { GAME_TIME_SCALE: '0.1' }); });
  afterAll(async () => { await server?.stop(); });

  it('3-player room: every bot decision arrives within 50-500ms (1-3s scaled)', async () => {
    const s = await connect(server.url);
    const tracker = new RoomTracker(s);
    const botDecisions: Array<{ bot: string; elapsed: number }> = [];
    let lotStartTime = 0;

    s.on('room_updated', (room: any) => {
      if (room.phase === 'first_half_auction') {
        lotStartTime = Date.now();
      }
    });

    s.on('new_bid', (data: any) => {
      if (data.team?.id.startsWith('bot')) {
        botDecisions.push({ bot: data.team.name, elapsed: Date.now() - lotStartTime });
      }
    });

    s.on('player_skipped_bid', (data: any) => {
      if (data.team?.id.startsWith('bot')) {
        botDecisions.push({ bot: data.team.name, elapsed: Date.now() - lotStartTime });
      }
    });

    try {
      const created = await emitAck<any>(s, 'create_room', { nickname: 'Human', maxPlayers: 3, competition: 'F1' });
      expect(created.success).toBe(true);
      const roomId = created.roomId;

      const started = await emitAck<any>(s, 'start_game', { roomId });
      expect(started.success).toBe(true);
      await tracker.waitForPhase('tactic_selection', 3000);

      await emitAck<any>(s, 'select_tactic', { roomId, tacticId: 'tiki-taka', formation: '4-3-3' });
      await tracker.waitForPhase('first_half_auction', 8000);

      // Human does nothing for 8 lots
      for (let lot = 0; lot < 8; lot++) {
        await waitFor(
          () => botDecisions.length > lot * 2,
          `bot decisions for lot ${lot}`,
          15000,
          () => `botDecisions so far: ${botDecisions.length}, phase: ${tracker.phase}`,
        );
      }

      // Check: every bot decision arrived within 50-500ms
      for (const decision of botDecisions) {
        expect(decision.elapsed, `${decision.bot} decision time should be 50-500ms (1-3s scaled)`).toBeGreaterThanOrEqual(50);
        expect(decision.elapsed, `${decision.bot} decision time should be 50-500ms (1-3s scaled)`).toBeLessThanOrEqual(500);
      }
    } finally {
      s.close();
    }
  }, 60000);
});

// ---------------------------------------------------------------------------
// Rule 5: GAME_TIME_SCALE scales all BALL-ON timers
// ---------------------------------------------------------------------------

describe('F1 Rule 5: GAME_TIME_SCALE scales all timers', () => {
  let server: TestServer;
  beforeAll(async () => { server = await startServer(3116, { GAME_TIME_SCALE: '0.1' }); });
  afterAll(async () => { await server?.stop(); });

  it('tactic_selection -> first_half_auction within 1000ms (2500ms scaled)', async () => {
    const s = await connect(server.url);
    const tracker = new RoomTracker(s);
    try {
      const created = await emitAck<any>(s, 'create_room', { nickname: 'Test', maxPlayers: 2, competition: 'F1' });
      expect(created.success).toBe(true);
      const roomId = created.roomId;

      const started = await emitAck<any>(s, 'start_game', { roomId });
      expect(started.success).toBe(true);
      await tracker.waitForPhase('tactic_selection', 3000);

      const tacticTime = Date.now();
      await emitAck<any>(s, 'select_tactic', { roomId, tacticId: 'tiki-taka', formation: '4-3-3' });
      await tracker.waitForPhase('first_half_auction', 8000);
      const elapsed = Date.now() - tacticTime;

      expect(elapsed, `Should reach first_half_auction within 1000ms (actual: ${elapsed}ms)`).toBeLessThan(1000);
    } finally {
      s.close();
    }
  });

  it('halftime ends by itself when BALLON_HALF_SECONDS timer expires', async () => {
    const server2 = await startServer(3117, { GAME_TIME_SCALE: '0.1', BALLON_HALF_SECONDS: '100' });
    const s = await connect(server2.url);
    const tracker = new RoomTracker(s);
    try {
      const created = await emitAck<any>(s, 'create_room', { nickname: 'Test', maxPlayers: 2, competition: 'F1' });
      expect(created.success).toBe(true);
      const roomId = created.roomId;

      const started = await emitAck<any>(s, 'start_game', { roomId });
      expect(started.success).toBe(true);
      await tracker.waitForPhase('tactic_selection', 3000);

      await emitAck<any>(s, 'select_tactic', { roomId, tacticId: 'tiki-taka', formation: '4-3-3' });
      await tracker.waitForPhase('first_half_auction', 8000);

      // Wait for halftime (triggered by timer at 100s scaled = 10s)
      await tracker.waitForPhase('halftime', 15000);
      const halftimeStart = Date.now();

      // Human never calls finish_halftime; second_half_auction must start by itself
      await tracker.waitForPhase('second_half_auction', 15000);
      const elapsed = Date.now() - halftimeStart;

      expect(elapsed, `Halftime should end after 6-12s (90s scaled = 9s)`).toBeGreaterThanOrEqual(6000);
      expect(elapsed, `Halftime should end after 6-12s (90s scaled = 9s)`).toBeLessThanOrEqual(12000);
    } finally {
      s.close();
      await server2.stop();
    }
  }, 60000);

  it('8-player room smoke test: reaches steal in <90s with fast timers', async () => {
    const s = await connect(server.url);
    const tracker = new RoomTracker(s);
    try {
      const created = await emitAck<any>(s, 'create_room', { nickname: 'Speed', maxPlayers: 8, competition: 'F1' });
      expect(created.success).toBe(true);
      const roomId = created.roomId;

      const started = await emitAck<any>(s, 'start_game', { roomId });
      expect(started.success).toBe(true);
      await tracker.waitForPhase('tactic_selection', 3000);

      const startTime = Date.now();
      await emitAck<any>(s, 'select_tactic', { roomId, tacticId: 'tiki-taka', formation: '4-3-3' });
      await tracker.waitForPhase('first_half_auction', 8000);

      let step = 0;
      const maxSteps = 500;
      while (tracker.phase === 'first_half_auction' || tracker.phase === 'halftime' || tracker.phase === 'second_half_auction') {
        if (++step > maxSteps) throw new Error(`Did not reach steal within ${maxSteps} steps. ${tracker.describe()}`);
        if (tracker.phase === 'halftime') {
          await emitAck<any>(s, 'finish_halftime', { roomId });
          await tracker.waitForPhase('second_half_auction', 3000);
          continue;
        }
        const phaseBefore = tracker.phase;
        await emitAck<any>(s, 'skip_player', { roomId });
        await waitFor(
          () => tracker.phase !== phaseBefore,
          `phase change from ${phaseBefore}`,
          6000,
          () => tracker.describe(),
        );
      }

      await tracker.waitForPhase('steal', 5000);
      const elapsed = Date.now() - startTime;
      expect(elapsed, `Should reach steal in <90s with GAME_TIME_SCALE=0.1 (actual: ${elapsed}ms)`).toBeLessThan(90000);
    } finally {
      s.close();
    }
  }, 120000);
});

// ---------------------------------------------------------------------------
// Rule 6: Pool exhaustion
// ---------------------------------------------------------------------------

describe('F1 Rule 6: pool exhaustion handling', () => {
  let server: TestServer;
  beforeAll(async () => { server = await startServer(3118, { GAME_TIME_SCALE: '0.1' }); });
  afterAll(async () => { await server?.stop(); });

  async function driveToStealAndCheck(maxPlayers: number) {
    const s = await connect(server.url);
    const tracker = new RoomTracker(s);
    try {
      const created = await emitAck<any>(s, 'create_room', { nickname: 'P', maxPlayers, competition: 'F1' });
      expect(created.success).toBe(true);
      const roomId = created.roomId;

      const started = await emitAck<any>(s, 'start_game', { roomId });
      expect(started.success).toBe(true);
      await tracker.waitForPhase('tactic_selection', 3000);

      await emitAck<any>(s, 'select_tactic', { roomId, tacticId: 'tiki-taka', formation: '4-3-3' });
      await tracker.waitForPhase('first_half_auction', 8000);

      // Human always skips, so the human team can only reach 11 through free fill (Rule 6)
      let step = 0;
      const maxSteps = 600;
      while (tracker.phase === 'first_half_auction' || tracker.phase === 'halftime' || tracker.phase === 'second_half_auction') {
        if (++step > maxSteps) throw new Error(`Did not reach steal within ${maxSteps} steps for ${maxPlayers} players. ${tracker.describe()}`);
        if (tracker.phase === 'halftime') {
          await emitAck<any>(s, 'finish_halftime', { roomId });
          await tracker.waitForPhase('second_half_auction', 3000);
          continue;
        }
        const phaseBefore = tracker.phase;
        const indexBefore = tracker.room.currentPlayerIndex;
        await emitAck<any>(s, 'skip_player', { roomId });
        await waitFor(
          () => tracker.phase !== phaseBefore || tracker.room.currentPlayerIndex !== indexBefore,
          `phase or index change from phase=${phaseBefore} index=${indexBefore}`,
          6000,
          () => tracker.describe(),
        );
      }

      await tracker.waitForPhase('steal', 5000);

      // Rule 6 checks
      const room = tracker.room;
      expect(room.teams, `${maxPlayers}-player room should have ${maxPlayers} teams`).toHaveLength(maxPlayers);

      // Human team must have 11 (only possible through free fill since human always skipped)
      const humanTeam = room.teams.find((t: any) => t.id === s.id);
      expect(humanTeam, 'human team should exist').toBeDefined();
      expect(humanTeam.roster, `human team must have 11 players (acquired through free fill)`).toHaveLength(11);

      for (const team of room.teams) {
        expect(team.roster, `team ${team.name} must have exactly 11 players`).toHaveLength(11);
        const counts = countCategories(team.roster);
        for (const [cat, limit] of Object.entries(AUCTION_LIMITS)) {
          expect(counts[cat as keyof typeof AUCTION_LIMITS], `team ${team.name} ${cat} must not exceed ${limit}`).toBeLessThanOrEqual(limit);
        }
      }

      const allPlayerIds = room.teams.flatMap((t: any) => t.roster.map((p: any) => p.id));
      expect(new Set(allPlayerIds).size, `no player id should appear twice across ${maxPlayers} teams`).toBe(allPlayerIds.length);
    } finally {
      s.close();
    }
  }

  it('3 teams: every team has exactly 11, no duplicates, position limits OK', async () => {
    await driveToStealAndCheck(3);
  }, 180000);

  it('6 teams: every team has exactly 11, no duplicates, position limits OK', async () => {
    await driveToStealAndCheck(6);
  }, 240000);

  it('8 teams: every team has exactly 11, no duplicates, position limits OK', async () => {
    await driveToStealAndCheck(8);
  }, 300000);
});

// ---------------------------------------------------------------------------
// Rule 7: Bid timer duration by room size
// ---------------------------------------------------------------------------

describe('F1 Rule 7: bid timer duration by room size', () => {
  let server: TestServer;
  beforeAll(async () => { server = await startServer(3119, { GAME_TIME_SCALE: '0.1' }); });
  afterAll(async () => { await server?.stop(); });

  it('5-player room: lot with 2+ bids closes after ~8s * GAME_TIME_SCALE', async () => {
    const s = await connect(server.url);
    const tracker = new RoomTracker(s);
    let lotStartTime = 0;
    let bidCount = 0;
    let lotClosedTime = 0;

    s.on('room_updated', (room: any) => {
      if (room.phase === 'first_half_auction' && room.currentPlayerIndex === 0) {
        lotStartTime = Date.now();
        bidCount = 0;
      }
    });

    s.on('new_bid', () => {
      bidCount++;
      if (bidCount === 2 && lotClosedTime === 0) {
        // Wait for the lot to close after 2+ bids
      }
    });

    s.on('current_player_changed', () => {
      if (bidCount >= 2 && lotClosedTime === 0) {
        lotClosedTime = Date.now();
      }
    });

    try {
      const created = await emitAck<any>(s, 'create_room', { nickname: 'Human', maxPlayers: 5, competition: 'F1' });
      expect(created.success).toBe(true);
      const roomId = created.roomId;

      const started = await emitAck<any>(s, 'start_game', { roomId });
      expect(started.success).toBe(true);
      await tracker.waitForPhase('tactic_selection', 3000);

      await emitAck<any>(s, 'select_tactic', { roomId, tacticId: 'tiki-taka', formation: '4-3-3' });
      await tracker.waitForPhase('first_half_auction', 8000);

      // Wait for a lot with 2+ bids
      await waitFor(
        () => lotClosedTime > 0,
        'lot with 2+ bids to close',
        30000,
        () => `bidCount=${bidCount}, lotStartTime=${lotStartTime}, lotClosedTime=${lotClosedTime}`,
      );

      const duration = lotClosedTime - lotStartTime;
      expect(duration, `5-player room bid timer should be ~800ms (8s * 0.1), actual: ${duration}ms`).toBeGreaterThanOrEqual(600);
      expect(duration, `5-player room bid timer should be ~800ms (8s * 0.1), actual: ${duration}ms`).toBeLessThanOrEqual(1000);
    } finally {
      s.close();
    }
  }, 60000);

  it('2-player room: lot with 2+ bids closes after ~14s * GAME_TIME_SCALE', async () => {
    const s = await connect(server.url);
    const tracker = new RoomTracker(s);
    let lotStartTime = 0;
    let bidCount = 0;
    let lotClosedTime = 0;

    s.on('room_updated', (room: any) => {
      if (room.phase === 'first_half_auction' && room.currentPlayerIndex === 0) {
        lotStartTime = Date.now();
        bidCount = 0;
      }
    });

    s.on('new_bid', () => {
      bidCount++;
    });

    s.on('current_player_changed', () => {
      if (bidCount >= 2 && lotClosedTime === 0) {
        lotClosedTime = Date.now();
      }
    });

    try {
      const created = await emitAck<any>(s, 'create_room', { nickname: 'Human', maxPlayers: 2, competition: 'F1' });
      expect(created.success).toBe(true);
      const roomId = created.roomId;

      const started = await emitAck<any>(s, 'start_game', { roomId });
      expect(started.success).toBe(true);
      await tracker.waitForPhase('tactic_selection', 3000);

      await emitAck<any>(s, 'select_tactic', { roomId, tacticId: 'tiki-taka', formation: '4-3-3' });
      await tracker.waitForPhase('first_half_auction', 8000);

      // Human bids on lot 0 immediately
      lotStartTime = Date.now();
      const bid = await emitAck<any>(s, 'place_bid', { roomId, amount: 1 });
      expect(bid.success, 'human bid should succeed').toBe(true);
      bidCount = 1;

      // Wait for bot to bid
      await waitFor(
        () => bidCount >= 2,
        'bot to bid',
        10000,
        () => `bidCount=${bidCount}`,
      );

      // Wait for lot to close
      await waitFor(
        () => lotClosedTime > 0,
        'lot to close after 2+ bids',
        5000,
        () => `bidCount=${bidCount}, lotClosedTime=${lotClosedTime}`,
      );

      const duration = lotClosedTime - lotStartTime;
      expect(duration, `2-player room bid timer should be ~1400ms (14s * 0.1), actual: ${duration}ms`).toBeGreaterThanOrEqual(1100);
      expect(duration, `2-player room bid timer should be ~1400ms (14s * 0.1), actual: ${duration}ms`).toBeLessThanOrEqual(1700);
    } finally {
      s.close();
    }
  }, 60000);
});
