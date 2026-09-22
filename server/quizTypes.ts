export type GameMode = 'solo' | 'team';
export type QuestionType = 'multiple_choice' | 'lightning' | 'top_5' | 'stat_detective' | 'formation_builder' | 'career_path' | 'match_maker';

export interface Player { id: string; nickname: string; isHost: boolean; team?: 'A' | 'B'; avatar: string; score: number; streak: number; connected: boolean; }
export interface BaseQuestion { id: string; type: QuestionType; question: string; time_limit: number; }
export interface MultipleChoiceQuestion extends BaseQuestion { type: 'multiple_choice'; options: string[]; correct_answer: string; points: number; }
export interface LightningQuestion extends BaseQuestion { type: 'lightning'; questions: { question: string; answer: boolean }[]; points_per_correct: number; multiplier: number; }
export interface Top5Question extends BaseQuestion { type: 'top_5'; options: string[]; correct_answers: string[]; points_per_answer: number; }
export interface StatDetectiveQuestion extends BaseQuestion { type: 'stat_detective'; stats: Record<string, string | number>; correct_answer: string; points: number; }
export interface FormationBuilderQuestion extends BaseQuestion { type: 'formation_builder'; formation: string; positions: { id: string; label: string }[]; correct_formation: Record<string, string>; points: number; }
export interface CareerPathQuestion extends BaseQuestion { type: 'career_path'; player: string; clubs: { name: string; years: string }[]; correct_order: string[]; points: number; }
export interface MatchMakerQuestion extends BaseQuestion { type: 'match_maker'; players: { name: string; hint: string }[]; teams: { name: string; hint: string }[]; correct_matches: Record<string, string>; points: number; }
export type Question = MultipleChoiceQuestion | LightningQuestion | Top5Question | StatDetectiveQuestion | FormationBuilderQuestion | CareerPathQuestion | MatchMakerQuestion;
export interface QuizAnswer { playerId: string; answer: unknown; submittedAt: number; pointsEarned: number; correct: boolean; }
export interface QuizRoom { id: string; mode: GameMode; hostId: string; players: Player[]; status: 'lobby' | 'playing' | 'results' | 'finished'; currentRound: number; totalRounds: number; questionOrder: string[]; question?: Question; roundStartedAt?: number; roundDeadline?: number; answered: QuizAnswer[]; roundScores: Record<string, number>; }
