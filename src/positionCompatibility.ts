import type { Position } from './types';

// Define position zones
const DEFENSE_POSITIONS: Position[] = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB'];
const MIDFIELD_POSITIONS: Position[] = ['DM', 'CM', 'AM', 'LM', 'RM'];
const ATTACK_POSITIONS: Position[] = ['LW', 'RW', 'ST'];

// Check if a player can play in a given slot position
export function canPlayInPosition(
  playerPrimary: Position,
  playerSecondary: Position[],
  slotPosition: Position
): boolean {
  // Exact match with primary or secondary
  if (playerPrimary === slotPosition || playerSecondary.includes(slotPosition)) {
    return true;
  }

  // Get zones
  const playerZone = getPositionZone(playerPrimary);
  const slotZone = getPositionZone(slotPosition);

  // Players can only play in their own zone or adjacent zones with restrictions
  if (playerZone === slotZone) {
    return canPlayWithinZone(playerPrimary, playerSecondary, slotPosition, playerZone);
  }

  // No cross-zone play allowed (e.g., CB cannot play CM, ST cannot play LM)
  return false;
}

function getPositionZone(position: Position): 'defense' | 'midfield' | 'attack' {
  if (DEFENSE_POSITIONS.includes(position)) return 'defense';
  if (MIDFIELD_POSITIONS.includes(position)) return 'midfield';
  if (ATTACK_POSITIONS.includes(position)) return 'attack';
  return 'defense'; // fallback
}

function canPlayWithinZone(
  playerPrimary: Position,
  playerSecondary: Position[],
  slotPosition: Position,
  zone: 'defense' | 'midfield' | 'attack'
): boolean {
  // Already checked exact match, now check zone compatibility

  if (zone === 'defense') {
    // GK can only play GK
    if (playerPrimary === 'GK' && slotPosition !== 'GK') return false;
    if (slotPosition === 'GK' && playerPrimary !== 'GK') return false;

    // Fullbacks (LB, RB, LWB, RWB) can play each other's positions on same side
    const leftDefenders: Position[] = ['LB', 'LWB'];
    const rightDefenders: Position[] = ['RB', 'RWB'];

    if (leftDefenders.includes(playerPrimary) && leftDefenders.includes(slotPosition)) return true;
    if (rightDefenders.includes(playerPrimary) && rightDefenders.includes(slotPosition)) return true;

    // CB can play LB/RB with penalty (but we allow for flexibility)
    if (playerPrimary === 'CB' && (slotPosition === 'LB' || slotPosition === 'RB')) return true;
    if ((playerPrimary === 'LB' || playerPrimary === 'RB') && slotPosition === 'CB') return true;

    return false;
  }

  if (zone === 'midfield') {
    // Midfielders have good flexibility within midfield
    // DM can play CM
    if (playerPrimary === 'DM' && slotPosition === 'CM') return true;
    if (playerPrimary === 'CM' && slotPosition === 'DM') return true;

    // CM can play AM
    if (playerPrimary === 'CM' && slotPosition === 'AM') return true;
    if (playerPrimary === 'AM' && slotPosition === 'CM') return true;

    // Wide midfielders (LM, RM) can play each other
    const leftMids: Position[] = ['LM'];
    const rightMids: Position[] = ['RM'];

    if (leftMids.includes(playerPrimary) && leftMids.includes(slotPosition)) return true;
    if (rightMids.includes(playerPrimary) && rightMids.includes(slotPosition)) return true;

    // LM/RM can play CM with penalty
    if ((playerPrimary === 'LM' || playerPrimary === 'RM') && slotPosition === 'CM') return true;
    if (playerPrimary === 'CM' && (slotPosition === 'LM' || slotPosition === 'RM')) return true;

    return false;
  }

  if (zone === 'attack') {
    // Wingers can play on their side
    const leftAttackers: Position[] = ['LW'];
    const rightAttackers: Position[] = ['RW'];

    if (leftAttackers.includes(playerPrimary) && leftAttackers.includes(slotPosition)) return true;
    if (rightAttackers.includes(playerPrimary) && rightAttackers.includes(slotPosition)) return true;

    // ST can play LW/RW
    if (playerPrimary === 'ST' && (slotPosition === 'LW' || slotPosition === 'RW')) return true;

    // LW/RW can play ST
    if ((playerPrimary === 'LW' || playerPrimary === 'RW') && slotPosition === 'ST') return true;

    return false;
  }

  return false;
}

// Get position penalty (0-20 points lost for out-of-position play)
export function getPositionPenalty(
  playerPrimary: Position,
  playerSecondary: Position[],
  slotPosition: Position
): number {
  // Perfect fit - no penalty
  if (playerPrimary === slotPosition) return 0;

  // Secondary position - small penalty
  if (playerSecondary.includes(slotPosition)) return 2;

  // Same zone but not natural - medium penalty
  const playerZone = getPositionZone(playerPrimary);
  const slotZone = getPositionZone(slotPosition);

  if (playerZone === slotZone) {
    // Specific penalties based on position compatibility
    if (playerPrimary === 'CB' && (slotPosition === 'LB' || slotPosition === 'RB')) return 5;
    if ((playerPrimary === 'LM' || playerPrimary === 'RM') && slotPosition === 'CM') return 3;
    if (playerPrimary === 'ST' && (slotPosition === 'LW' || slotPosition === 'RW')) return 4;
    return 5; // Default same-zone penalty
  }

  // Should not happen if canPlayInPosition is used correctly
  return 20;
}
