/**
 * BALL-ON full game flow: lobby -> tactic selection -> two auction halves -> steal -> trade
 * -> match -> result. Nobody sends 'simulate_match': the match must start by itself (K1 fixed).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, setupBallOn, playToMatch, EXPECTED_PHASES, CATEGORY, type TestServer } from './helpers';

let server: TestServer;
beforeAll(async () => { server = await startServer(3101); });
afterAll(async () => { await server?.stop(); });

function checkRostersAtSteal(room: any) {
  for (const team of room.teams) {
    expect(team.roster, `team ${team.name} roster size at steal`).toHaveLength(11);
    expect(team.budget, `team ${team.name} budget`).toBeGreaterThanOrEqual(0);
    for (const p of team.roster) expect(CATEGORY[p.primaryPosition], `known position for ${p.name}`).toBeDefined();
  }
  const ids = room.teams.flatMap((t: any) => t.roster.map((p: any) => p.id));
  expect(new Set(ids).size, 'no player id appears twice across rosters').toBe(ids.length);
}

/** After the trade phase the match must start by itself (K1 fixed) and end with one result. */
async function expectAutomaticResult(game: Awaited<ReturnType<typeof setupBallOn>>) {
  // The server shows 'match' for about 3 s, then sends the result.
  await game.tracker.waitForPhase('result', 8000);
  expect(game.tracker.phases).toEqual([...EXPECTED_PHASES, 'result']);
  expect(game.tracker.matchResults).toHaveLength(1);
  const r = game.tracker.matchResults[0];
  expect(Number.isInteger(r.homeScore)).toBe(true);
  expect(Number.isInteger(r.awayScore)).toBe(true);
  expect(r.homeScore).toBeGreaterThanOrEqual(0);
  expect(r.awayScore).toBeGreaterThanOrEqual(0);
}

describe('BALL-ON full flow', () => {
  it('2 humans: lobby -> ... -> match -> result by itself, with rules checked after every sold player', async () => {
    const game = await setupBallOn(server.url, 2);
    try {
      const { roomAtSteal } = await playToMatch(game);
      expect(game.tracker.phases).toEqual(EXPECTED_PHASES);
      expect(game.soldChecks, 'position limits were checked after many sold players').toBeGreaterThan(20);
      expect(game.bidsPlaced, 'some bids were accepted').toBeGreaterThan(0);
      checkRostersAtSteal(roomAtSteal);
      expect(roomAtSteal.teams).toHaveLength(2);
      expect(roomAtSteal.teams.some((t: any) => t.id.startsWith('bot')), 'no bot in a 2-human room').toBe(false);
      await expectAutomaticResult(game);
    } finally {
      game.close();
    }
  });

  it('bot mode (1 human vs 1 bot): same flow to result, the bot also ends with 11 players', async () => {
    const game = await setupBallOn(server.url, 1);
    try {
      const { roomAtSteal } = await playToMatch(game);
      expect(game.tracker.phases).toEqual(EXPECTED_PHASES);
      checkRostersAtSteal(roomAtSteal);
      // Bots are recognised by an id starting with 'bot' (server/index.ts).
      const bots = roomAtSteal.teams.filter((t: any) => t.id.startsWith('bot'));
      expect(bots, 'exactly one bot team').toHaveLength(1);
      expect(bots[0].roster).toHaveLength(11);
      expect(game.bidsPlaced, 'the human placed exactly one successful bid').toBe(1);
      await expectAutomaticResult(game);
    } finally {
      game.close();
    }
  });
});
