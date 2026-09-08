export type Position = 'GK' | 'CB' | 'LB' | 'RB' | 'LWB' | 'RWB' | 'DM' | 'CM' | 'AM' | 'LM' | 'RM' | 'LW' | 'RW' | 'ST';
export type MarketTier = 'star' | 'high' | 'medium' | 'low';

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
  archetype: string;
  preferredRoles: string[];
  attributes: PlayerAttributes;
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
}

export type Phase = 'lobby' | 'auction' | 'completion' | 'steal' | 'trade' | 'lineup' | 'tactics' | 'match' | 'result';

export interface Room {
  id: string;
  teams: Team[];
  phase: Phase;
  currentPlayerIndex: number;
  auctionPool: Player[];
  stealChoices?: Record<string, { target: string; offer: string; protect: string }>;
  tradeOffers?: Array<{ from: string; to: string; give: Player; want: Player }>;
  matchResult?: MatchResult;
  marketTrend?: 'boom' | 'crash' | 'stable';
  upcomingStars?: string[]; // Player IDs that are leaked as "coming soon"
  auctionState?: {
    currentBids: Record<string, number>; // teamId -> bid amount
    highestBidder: string | null;
    highestBid: number;
    timeLeft: number; // seconds
    timerStarted: number; // timestamp
  };
  maxPlayers: number; // Maximum number of players (2, 4, 6, or 8)
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
