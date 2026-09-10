export type Position = 'GK' | 'CB' | 'LB' | 'RB' | 'LWB' | 'RWB' | 'DM' | 'CM' | 'AM' | 'LM' | 'RM' | 'LW' | 'RW' | 'ST';
export type MarketTier = 'star' | 'high' | 'medium' | 'low';

export type JokerType = 'budget' | 'scout' | 'buff' | 'free_transfer';

export interface Joker {
  type: JokerType;
  value: number; // For budget: CR amount, for scout/buff: count, for free_transfer: minimum bid
  revealed: boolean;
}

export interface PlayerAttributes {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  aerial: number;
  vision: number;
  stamina: number;
  composure: number;
}

export interface Player {
  id: string;
  name: string;
  age: number;
  primaryPosition: Position;
  secondaryPositions: Position[];
  baseOverall: number;
  marketTier: MarketTier;
  marketValue?: number; // CR - Expected auction price (calculated dynamically)
  archetype: string;
  preferredRoles: string[];
  attributes: PlayerAttributes;
  joker?: Joker; // Hidden bonus that reveals on purchase
}

export interface Team {
  id: string;
  name: string;
  budget: number;
  roster: Player[];
  ready: boolean;
  scouts: number;
  buff: number;
  formation?: string;
  tactic?: string;
  lineup?: Record<string, string>; // slot -> playerId
  chosenTactic?: string; // Pre-auction tactic selection (locked for entire game)
}

export type Phase = 'lobby' | 'tactic_selection' | 'first_half_auction' | 'halftime' | 'second_half_auction' | 'completion' | 'steal' | 'trade' | 'match' | 'result';

export interface Room {
  id: string;
  teams: Team[];
  phase: Phase;
  currentPlayerIndex: number;
  auctionPool: Player[];
  stealChoices?: Record<string, { target: string; offer: string; protect: string }>;
  tradeOffers?: Array<{ from: string; to: string; give: Player; want: Player }>;
  tradeResponses?: Set<string>; // Track who has responded to trade offers
  matchResult?: MatchResult;
  firstHalfResult?: MatchResult; // First half stats
  marketTrend?: 'boom' | 'crash' | 'stable';
  upcomingStars?: string[]; // Player IDs that are leaked as "coming soon"
  halftimeOffers?: Array<{ from: string; to: string; give: Player; want: Player; price?: number }>; // Transfer offers during halftime
  halftimeResponses?: Set<string>; // Track who has finished halftime transfer window
  halftimeTimer?: number; // Halftime countdown in seconds
  marketplace?: Array<{ player: Player; sellerId: string; sellerName: string; price: number }>; // Players for sale in marketplace
  auctionState?: {
    currentBids: Record<string, number>; // teamId -> bid amount
    highestBidder: string | null;
    highestBid: number;
    timeLeft: number; // seconds
    timerStarted: number; // timestamp
    skippedPlayers: string[]; // teamIds that have skipped
  };
  maxPlayers: number; // Maximum number of players (2, 4, 6, or 8)
  competition: string; // Competition name (e.g., "Premier League", "Champions League")
}

export interface MatchResult {
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  stats: MatchStats;
}

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'yellow' | 'red' | 'sub' | 'chance' | 'tactical';
  team: string;
  description: string;
}

export interface MatchStats {
  possession: [number, number];
  shots: [number, number];
  xG: [number, number];
  passAccuracy: [number, number];
}
