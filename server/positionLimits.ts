import type { Player, Team } from '../src/types';

// Get position limits based on formation (11 players total)
export function getFormationLimits(formation: string): { GK: number; DEF: number; MID: number; ATT: number } {
  // Parse formation (e.g., "4-3-3" -> [4, 3, 3])
  const parts = formation.split('-').map(n => parseInt(n));

  if (parts.length === 3) {
    const [def, mid, att] = parts;
    return {
      GK: 1,
      DEF: def,
      MID: mid,
      ATT: att
    };
  }

  // Default to 4-3-3 if parsing fails
  return { GK: 1, DEF: 4, MID: 3, ATT: 3 };
}

// Position limits for squad building (default)
export const POSITION_LIMITS = {
  GK: 1,
  DEF: 4,
  MID: 3,
  ATT: 3
};

export function getPositionCategory(position: string): 'GK' | 'DEF' | 'MID' | 'ATT' {
  if (position === 'GK') return 'GK';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(position)) return 'DEF';
  if (['DM', 'CM', 'AM', 'LM', 'RM'].includes(position)) return 'MID';
  if (['LW', 'RW', 'ST'].includes(position)) return 'ATT';
  return 'MID'; // Default
}

export function canAddPlayer(team: Team, player: Player, formation?: string): { allowed: boolean; reason?: string } {
  // Get formation limits (use team's chosen formation or default)
  const limits = formation ? getFormationLimits(formation) : getFormationLimits(team.chosenTactic || '4-3-3');

  // Check if roster is full (11 players)
  if (team.roster.length >= 11) {
    return { allowed: false, reason: 'Kadro dolu (11/11)' };
  }

  // Check position limits
  const category = getPositionCategory(player.primaryPosition);
  const categoryCount = team.roster.filter(p => getPositionCategory(p.primaryPosition) === category).length;

  const limit = limits[category];
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
