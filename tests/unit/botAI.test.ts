import { describe, it, expect } from 'vitest';
import { BotAI } from '../../server/botAI';
import type { Team, Player } from '../../src/types';

describe('botAI', () => {
  const createPlayer = (overrides: Partial<Player> = {}): Player => ({
    id: 'player-1',
    name: 'Test Player',
    age: 25,
    primaryPosition: 'CM',
    secondaryPositions: [],
    baseOverall: 75,
    marketTier: 'medium',
    marketValue: 10,
    archetype: 'Standard',
    preferredRoles: [],
    attributes: {
      pace: 70, shooting: 70, passing: 70, dribbling: 70,
      defending: 70, physical: 70, aerial: 70, vision: 70,
      stamina: 70, composure: 70
    },
    ...overrides
  });

  const createTeam = (budget: number, rosterSize: number): Team => ({
    id: 'bot-team',
    name: 'Bot Team',
    budget,
    roster: Array.from({ length: rosterSize }, (_, i) => createPlayer({ id: `player-${i}` })),
    ready: false,
    scouts: 3,
    buff: 0
  });

  describe('calculateBid', () => {
    it('never exceeds budget - slotsRemaining + 1', () => {
      for (let budget = 20; budget <= 100; budget += 10) {
        for (let rosterSize = 0; rosterSize <= 10; rosterSize++) {
          const team = createTeam(budget, rosterSize);
          const bot = new BotAI(team);
          const player = createPlayer({ marketValue: 50 });

          const bid = bot.calculateBid(player);
          const slotsRemaining = 11 - rosterSize;
          const maxAllowed = budget - slotsRemaining + 1;

          expect(bid).toBeLessThanOrEqual(maxAllowed);
        }
      }
    });

    it('returns at least 1', () => {
      const team = createTeam(5, 9);
      const bot = new BotAI(team);
      const player = createPlayer({ marketValue: 100 });

      const bid = bot.calculateBid(player);
      expect(bid).toBeGreaterThanOrEqual(1);
    });
  });

  describe('shouldBid', () => {
    it('returns false when budget <= slotsRemaining', () => {
      const team1 = createTeam(5, 6); // budget 5, slots 5
      const bot1 = new BotAI(team1);
      expect(bot1.shouldBid(createPlayer({ marketValue: 3 }))).toBe(false);

      const team2 = createTeam(3, 8); // budget 3, slots 3
      const bot2 = new BotAI(team2);
      expect(bot2.shouldBid(createPlayer({ marketValue: 2 }))).toBe(false);

      const team3 = createTeam(2, 9); // budget 2, slots 2
      const bot3 = new BotAI(team3);
      expect(bot3.shouldBid(createPlayer({ marketValue: 1 }))).toBe(false);
    });

    it('returns false when slotsRemaining is 0', () => {
      const team = createTeam(50, 11); // full roster
      const bot = new BotAI(team);
      expect(bot.shouldBid(createPlayer())).toBe(false);
    });

    it('returns false when budget < marketValue', () => {
      const team = createTeam(5, 0);
      const bot = new BotAI(team);
      expect(bot.shouldBid(createPlayer({ marketValue: 10 }))).toBe(false);
    });
  });
});
