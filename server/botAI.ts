import type { Player, Team } from '../src/types';

export class BotAI {
  private team: Team;
  private budget: number;
  private slotsRemaining: number;

  constructor(team: Team) {
    this.team = team;
    this.budget = team.budget;
    this.slotsRemaining = 11 - team.roster.length;
  }

  // Decide if bot should bid on a player
  shouldBid(player: Player): boolean {
    if (this.slotsRemaining <= 0) return false;
    if (this.budget <= this.slotsRemaining) return false; // Reserve minimum budget

    // Check if we can afford the market value
    const marketValue = player.marketValue || 5;
    if (this.budget < marketValue) return false;

    // Check if position is needed
    const positionCount = this.team.roster.filter(p => p.primaryPosition === player.primaryPosition).length;

    // Prioritize positions we don't have
    if (positionCount === 0 && player.marketTier !== 'low') {
      return true;
    }

    // Don't buy too many of the same position
    if (positionCount >= 3) {
      return false;
    }

    // Tier-based decision
    if (player.marketTier === 'star') {
      return this.budget >= marketValue + 5; // Need extra budget for stars
    }

    if (player.marketTier === 'high') {
      return this.budget >= marketValue + 3;
    }

    if (player.marketTier === 'medium') {
      return this.budget >= marketValue;
    }

    // Buy low tier players if budget is tight
    return this.slotsRemaining > 5;
  }

  // Calculate bid amount
  calculateBid(player: Player): number {
    const marketValue = player.marketValue || 5;
    let baseBid = marketValue;

    // Add some randomness: 80-120% of market value
    const randomFactor = 0.8 + Math.random() * 0.4;
    baseBid = Math.round(baseBid * randomFactor);

    // Check position need - increase bid if position is needed
    const positionCount = this.team.roster.filter(p => p.primaryPosition === player.primaryPosition).length;
    if (positionCount === 0) {
      baseBid = Math.round(baseBid * 1.2); // Increase bid for needed positions
    }

    // Tier-based adjustment
    if (player.marketTier === 'star') {
      baseBid = Math.round(baseBid * 1.1); // Willing to overpay for stars
    }

    // Ensure we reserve budget for remaining slots
    const maxBid = this.budget - this.slotsRemaining + 1;
    return Math.max(1, Math.min(baseBid, maxBid));
  }

  // Select player to steal from opponent
  selectStealTarget(opponentRoster: Player[]): Player | null {
    if (opponentRoster.length === 0) return null;

    // Target highest overall player
    const sorted = [...opponentRoster].sort((a, b) => b.baseOverall - a.baseOverall);
    return sorted[0];
  }

  // Select player to offer in exchange
  selectOfferPlayer(targetPlayer: Player): Player | null {
    if (this.team.roster.length === 0) return null;

    // Offer a player of similar position but lower overall
    const samePositionPlayers = this.team.roster.filter(
      p => p.primaryPosition === targetPlayer.primaryPosition || p.secondaryPositions.includes(targetPlayer.primaryPosition)
    );

    if (samePositionPlayers.length > 0) {
      // Offer the weakest one
      return samePositionPlayers.sort((a, b) => a.baseOverall - b.baseOverall)[0];
    }

    // Otherwise offer weakest player overall
    return [...this.team.roster].sort((a, b) => a.baseOverall - b.baseOverall)[0];
  }

  // Select player to protect from stealing
  selectProtectedPlayer(): Player | null {
    if (this.team.roster.length === 0) return null;

    // Protect highest overall player
    return [...this.team.roster].sort((a, b) => b.baseOverall - a.baseOverall)[0];
  }

  // Decide whether to accept a trade
  shouldAcceptTrade(offered: Player, wanted: Player): boolean {
    // Accept if we're getting a better player
    return offered.baseOverall > wanted.baseOverall + 5;
  }

  // Select formation based on roster
  selectFormation(): string {
    const positions = this.team.roster.map(p => p.primaryPosition);

    const defenders = positions.filter(p => p === 'CB' || p === 'LB' || p === 'RB').length;
    const midfielders = positions.filter(p => p === 'DM' || p === 'CM' || p === 'AM').length;
    const forwards = positions.filter(p => p === 'ST' || p === 'LW' || p === 'RW').length;

    if (defenders >= 4 && midfielders >= 3 && forwards >= 3) {
      return '4-3-3';
    } else if (defenders >= 4 && midfielders >= 4 && forwards >= 2) {
      return '4-4-2';
    } else if (defenders >= 4 && midfielders >= 5 && forwards >= 1) {
      return '4-2-3-1';
    } else if (defenders >= 3 && midfielders >= 5 && forwards >= 2) {
      return '3-5-2';
    }

    return '4-3-3'; // Default
  }

  // Select tactics
  selectTactics(): string {
    const avgPace = this.team.roster.reduce((sum, p) => sum + p.attributes.pace, 0) / this.team.roster.length;
    const avgDefending = this.team.roster.reduce((sum, p) => sum + p.attributes.defending, 0) / this.team.roster.length;

    if (avgPace > 80) {
      return 'Fast-Attacking'; // Counter-attack style
    } else if (avgDefending > 75) {
      return 'Defensive-Slow'; // Defensive style
    } else {
      return 'Balanced-Normal'; // Balanced
    }
  }
}
