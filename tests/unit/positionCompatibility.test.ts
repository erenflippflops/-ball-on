import { describe, it, expect } from 'vitest';
import { getPositionPenalty, canPlayInPosition } from '../../src/positionCompatibility';
import type { Position } from '../../src/types';

describe('positionCompatibility', () => {
  describe('getPositionPenalty', () => {
    it('returns 0 for primary position match', () => {
      expect(getPositionPenalty('CM', ['DM'], 'CM')).toBe(0);
      expect(getPositionPenalty('ST', ['LW'], 'ST')).toBe(0);
    });

    it('returns 2 for secondary position match', () => {
      expect(getPositionPenalty('CM', ['DM', 'AM'], 'DM')).toBe(2);
      expect(getPositionPenalty('ST', ['LW', 'RW'], 'LW')).toBe(2);
    });

    it('returns 5 for CB to LB/RB', () => {
      expect(getPositionPenalty('CB', [], 'LB')).toBe(5);
      expect(getPositionPenalty('CB', [], 'RB')).toBe(5);
    });

    it('returns 3 for LM/RM to CM', () => {
      expect(getPositionPenalty('LM', [], 'CM')).toBe(3);
      expect(getPositionPenalty('RM', [], 'CM')).toBe(3);
    });

    it('returns 4 for ST to LW/RW', () => {
      expect(getPositionPenalty('ST', [], 'LW')).toBe(4);
      expect(getPositionPenalty('ST', [], 'RW')).toBe(4);
    });

    it('returns 20 for cross-zone position', () => {
      expect(getPositionPenalty('CB', [], 'CM')).toBe(20);
      expect(getPositionPenalty('ST', [], 'DM')).toBe(20);
    });
  });

  describe('canPlayInPosition', () => {
    it('returns true for exact primary match', () => {
      expect(canPlayInPosition('CM', [], 'CM')).toBe(true);
      expect(canPlayInPosition('ST', [], 'ST')).toBe(true);
    });

    it('returns true for secondary position match', () => {
      expect(canPlayInPosition('CM', ['DM', 'AM'], 'DM')).toBe(true);
      expect(canPlayInPosition('ST', ['LW'], 'LW')).toBe(true);
    });

    it('returns true for same-zone compatibility - defense', () => {
      expect(canPlayInPosition('CB', [], 'LB')).toBe(true);
      expect(canPlayInPosition('LB', [], 'LWB')).toBe(true);
      expect(canPlayInPosition('RB', [], 'RWB')).toBe(true);
    });

    it('returns true for same-zone compatibility - midfield', () => {
      expect(canPlayInPosition('DM', [], 'CM')).toBe(true);
      expect(canPlayInPosition('CM', [], 'AM')).toBe(true);
      expect(canPlayInPosition('LM', [], 'CM')).toBe(true);
    });

    it('returns true for same-zone compatibility - attack', () => {
      expect(canPlayInPosition('ST', [], 'LW')).toBe(true);
      expect(canPlayInPosition('LW', [], 'ST')).toBe(true);
    });

    it('returns false for cross-zone positions', () => {
      expect(canPlayInPosition('CB', [], 'CM')).toBe(false);
      expect(canPlayInPosition('CM', [], 'ST')).toBe(false);
      expect(canPlayInPosition('ST', [], 'CB')).toBe(false);
    });

    it('returns false for GK to non-GK', () => {
      expect(canPlayInPosition('GK', [], 'CB')).toBe(false);
    });

    it('returns false for non-GK to GK', () => {
      expect(canPlayInPosition('CB', [], 'GK')).toBe(false);
    });
  });
});
