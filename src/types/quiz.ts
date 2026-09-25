export interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  team?: 'A' | 'B';
  avatar: string;
  score: number;
  streak: number;
  connected: boolean;
}

export interface QuizAnswer {
  playerId: string;
  answer: unknown;
  submittedAt: number;
  pointsEarned: number;
  correct: boolean;
}

export interface Room {
  id: string;
  mode: 'solo' | 'team';
  hostId: string;
  players: Player[];
  status: 'lobby' | 'playing' | 'results' | 'finished';
  currentRound: number;
  totalRounds: number;
  question?: Question;
  answered: QuizAnswer[];
  roundScores: Record<string, number>;
}

export type QuestionType =
  | 'multiple_choice'
  | 'lightning'
  | 'top_5'
  | 'stat_detective'
  | 'formation_builder'
  | 'career_path'
  | 'match_maker';

export interface BaseQuestion {
  id: string;
  type: QuestionType;
  question: string;
  time_limit: number;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple_choice';
  options: string[];
  points: number;
}

export interface Top5Question extends BaseQuestion {
  type: 'top_5';
  options: string[];
  points_per_answer: number;
}

export type Question = MultipleChoiceQuestion | Top5Question | any;
