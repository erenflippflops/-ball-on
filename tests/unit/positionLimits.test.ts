import { describe, it, expect } from 'vitest';
import { getPositionCategory, getFormationLimits, canAddPlayer } from '../../server/positionLimits';
import type { Team, Player, Position } from '../../src/types';

describe('positionLimits', () => {
  describe('getPositionCategory', () => {
    it('returns GK for GK position', () => {
      expect(getPositionCategory('GK')).toBe('GK');
    });

    it('returns DEF for all defender positions', () => {
      expect(getPositionCategory('CB')).toBe('DEF');
      expect(getPositionCategory('LB')).toBe('DEF');
      expect(getPositionCategory('RB')).toBe('DEF');
      expect(getPositionCategory('LWB')).toBe('DEF');
      expect(getPositionCategory('RWB')).toBe('DEF');
    });

    it('returns MID for all midfielder positions', () => {
      expect(getPositionCategory('DM')).toBe('MID');
      expect(getPositionCategory('CM')).toBe('MID');
      expect(getPositionCategory('AM')).toBe('MID');
      expect(getPositionCategory('LM')).toBe('MID');
      expect(getPositionCategory('RM')).toBe('MID');
    });

    it('returns ATT for all attacker positions', () => {
      expect(getPositionCategory('LW')).toBe('ATT');
      expect(getPositionCategory('RW')).toBe('ATT');
      expect(getPositionCategory('ST')).toBe('ATT');
    });
  });

  describe('getFormationLimits', () => {
    it('parses 4-3-3 correctly', () => {
      expect(getFormationLimits('4-3-3')).toEqual({
        GK: 1,
        DEF: 4,
        MID: 3,
        ATT: 3
      });
    });

    it('parses 4-4-2 correctly', () => {
      expect(getFormationLimits('4-4-2')).toEqual({
        GK: 1,
        DEF: 4,
        MID: 4,
        ATT: 2
      });
    });

    it('parses 3-5-2 correctly', () => {
      expect(getFormationLimits('3-5-2')).toEqual({
        GK: 1,
        DEF: 3,
        MID: 5,
        ATT: 2
      });
    });

    it('returns default 4-3-3 for unparseable string', () => {
      expect(getFormationLimits('invalid')).toEqual({
        GK: 1,
        DEF: 4,
        MID: 3,
        ATT: 3
      });
      expect(getFormationLimits('4-3')).toEqual({
        GK: 1,
        DEF: 4,
        MID: 3,
        ATT: 3
      });
      expect(getFormationLimits('')).toEqual({
        GK: 1,
        DEF: 4,
        MID: 3,
        ATT: 3
      });
    });
  });

  describe('canAddPlayer', () => {
    const createTeam = (roster: Partial<Player>[], chosenTactic?: string): Team => ({
      id: 'test-team',
      name: 'Test Team',
      budget: 100,
      roster: roster.map((p, i) => ({
        id: `player-${i}`,
        name: `Player ${i}`,
        age: 25,
        primaryPosition: p.primaryPosition || 'CM',
        secondaryPositions: [],
        baseOverall: 75,
        marketTier: 'medium' as const,
        archetype: 'Standard',
        preferredRoles: [],
        attributes: {
          pace: 70, shooting: 70, passing: 70, dribbling: 70,
          defending: 70, physical: 70, aerial: 70, vision: 70,
          stamina: 70, composure: 70
        }
      } as Player)),
      ready: false,
      scouts: 3,
      buff: 0,
      chosenTactic
    });

    const createPlayer = (position: Position): Player => ({
      id: 'new-player',
      name: 'New Player',
      age: 25,
      primaryPosition: position,
      secondaryPositions: [],
      baseOverall: 75,
      marketTier: 'medium',
      archetype: 'Standard',
      preferredRoles: [],
      attributes: {
        pace: 70, shooting: 70, passing: 70, dribbling: 70,
        defending: 70, physical: 70, aerial: 70, vision: 70,
        stamina: 70, composure: 70
      }
    });

    it('rejects when roster is full at 11', () => {
      const team = createTeam([
        { primaryPosition: 'GK' },
        { primaryPosition: 'CB' }, { primaryPosition: 'CB' },
        { primaryPosition: 'LB' }, { primaryPosition: 'RB' },
        { primaryPosition: 'CM' }, { primaryPosition: 'CM' }, { primaryPosition: 'CM' },
        { primaryPosition: 'LW' }, { primaryPosition: 'RW' }, { primaryPosition: 'ST' }
      ]);
      const result = canAddPlayer(team, createPlayer('CM'));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Kadro dolu');
    });

    it('rejects second GK when limit is 1', () => {
      const team = createTeam([{ primaryPosition: 'GK' }]);
      const result = canAddPlayer(team, createPlayer('GK'));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('GK');
    });

    it('rejects 5th DEF with default 4-3-3', () => {
      const team = createTeam([
        { primaryPosition: 'CB' }, { primaryPosition: 'CB' },
        { primaryPosition: 'LB' }, { primaryPosition: 'RB' }
      ]);
      const result = canAddPlayer(team, createPlayer('CB'));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('DEF');
    });

    it('allows player when within limits', () => {
      const team = createTeam([{ primaryPosition: 'GK' }]);
      const result = canAddPlayer(team, createPlayer('CB'));
      expect(result.allowed).toBe(true);
    });

    it.fails('KNOWN BUG K3: reads formation from chosenTactic (tactic name) instead of formation field', () => {
      const team = createTeam(
        [
          { primaryPosition: 'GK' },
          { primaryPosition: 'CB' }, { primaryPosition: 'LB' }, { primaryPosition: 'RB' },
          { primaryPosition: 'CM' }, { primaryPosition: 'CM' }, { primaryPosition: 'CM' }
        ],
        'tiki-taka'
      );
      team.formation = '3-5-2';

      const result4thMid = canAddPlayer(team, createPlayer('CM'));
      expect(result4thMid.allowed).toBe(true);

      team.roster.push(createPlayer('CM'));
      const result5thMid = canAddPlayer(team, createPlayer('CM'));
      expect(result5thMid.allowed).toBe(true);
    });
  });
});
