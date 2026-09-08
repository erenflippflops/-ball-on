import type { Player, Team } from '../src/types';

// Position limits for squad building
export const POSITION_LIMITS = {
  GK: 2,
  DEF: 5, // CB, LB, RB, LWB, RWB combined
  MID: 5, // DM, CM, AM, LM, RM combined
  ATT: 4  // LW, RW, ST combined
};

export function getPositionCategory(position: string): 'GK' | 'DEF' | 'MID' | 'ATT' {
  if (position === 'GK') return 'GK';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(position)) return 'DEF';
  if (['DM', 'CM', 'AM', 'LM', 'RM'].includes(position)) return 'MID';
  if (['LW', 'RW', 'ST'].includes(position)) return 'ATT';
  return 'MID'; // Default
}

export function canAddPlayer(team: Team, player: Player): { allowed: boolean; reason?: string } {
  // Check if roster is full
  if (team.roster.length >= 14) {
    return { allowed: false, reason: 'Kadro dolu (14/14)' };
  }

  // Check position limits
  const category = getPositionCategory(player.primaryPosition);
  const categoryCount = team.roster.filter(p => getPositionCategory(p.primaryPosition) === category).length;

  const limit = POSITION_LIMITS[category];
  if (categoryCount >= limit) {
    return {
      allowed: false,
      reason: `${category} pozisyonu dolu (${categoryCount}/${limit})`
    };
  }

  return { allowed: true };
}

export function getPositionStats(team: Team): Record<string, number> {
  const stats: Record<string, number> = {
    GK: 0,
    DEF: 0,
    MID: 0,
    ATT: 0
  };

  team.roster.forEach(player => {
    const category = getPositionCategory(player.primaryPosition);
    stats[category]++;
  });

  return stats;
}
