import { describe, it, expect } from 'vitest';
import { simulateMatch } from '../../server/matchSimulator';
import type { Team } from '../../src/types';

describe('matchSimulator', () => {
  const createTeam = (id: string, name: string, rosterSize: number = 11): Team => ({
    id,
    name,
    budget: 100,
    roster: Array.from({ length: rosterSize }, (_, i) => ({
      id: `${id}-player-${i}`,
      name: `Player ${i}`,
      age: 25,
      primaryPosition: 'CM' as const,
      secondaryPositions: [],
      baseOverall: 75,
      marketTier: 'medium' as const,
      archetype: 'Standard',
      preferredRoles: [],
      attributes: {
        pace: 70,
        shooting: 70,
        passing: 70,
        dribbling: 70,
        defending: 70,
        physical: 70,
        aerial: 70,
        vision: 70,
        stamina: 70,
        composure: 70
      }
    })),
    ready: false,
    scouts: 3,
    buff: 0
  });

  it('returns identical results for same seed and teams', () => {
    const team1 = createTeam('team1', 'Team 1');
    const team2 = createTeam('team2', 'Team 2');
    const seed = 12345;

    const result1 = simulateMatch({ team1, team2, seed });
    const result2 = simulateMatch({ team1, team2, seed });

    expect(result1).toEqual(result2);
  });

  it('returns non-negative integer scores', () => {
    const team1 = createTeam('team1', 'Team 1');
    const team2 = createTeam('team2', 'Team 2');

    const result = simulateMatch({ team1, team2, seed: 99999 });

    expect(result.homeScore).toBeGreaterThanOrEqual(0);
    expect(result.awayScore).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result.homeScore)).toBe(true);
    expect(Number.isInteger(result.awayScore)).toBe(true);
  });

  it('possession values sum to 100', () => {
    const team1 = createTeam('team1', 'Team 1');
    const team2 = createTeam('team2', 'Team 2');

    const result = simulateMatch({ team1, team2, seed: 54321 });

    const [possession1, possession2] = result.stats.possession;
    expect(possession1 + possession2).toBe(100);
  });
});
