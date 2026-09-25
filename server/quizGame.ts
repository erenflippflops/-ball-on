import { randomBytes, randomUUID } from 'node:crypto';
import type { QuizAnswer, QuizRoom, Question, Player } from './quizTypes.js';
import { t, type Language } from './i18n.js';

// Constants
const AVATARS = ['🏆', '⭐', '🎯', '🎨', '🚀', '⚡'];
const MAX_PLAYERS = 6;
const MIN_PLAYERS = 2;

// Load questions
const [baseQuestionModule, extraQuestionModule] = await Promise.all([
  import('./questions.json', { with: { type: 'json' } }),
  import('./questions-extra.json', { with: { type: 'json' } })
]);
const questions = [
  ...baseQuestionModule.default,
  ...extraQuestionModule.default
] as Question[];

// In-memory storage
const rooms = new Map<string, QuizRoom>();

// Utility functions
function normalize(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('tr-TR');
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function generateRoomCode(): string {
  return randomBytes(3).toString('hex').toUpperCase();
}

// Room management
export function createRoom(
  nickname: string,
  mode: 'solo' | 'team',
  lang: Language = 'tr'
): { room: QuizRoom; playerId: string } {
  const id = generateRoomCode();
  const player: Player = {
    id: randomUUID(),
    nickname,
    isHost: true,
    team: mode === 'team' ? 'A' : undefined,
    avatar: AVATARS[0],
    score: 0,
    streak: 0,
    connected: true
  };

  const room: QuizRoom = {
    id,
    mode,
    hostId: player.id,
    players: [player],
    status: 'lobby',
    currentRound: 0,
    totalRounds: 10,
    questionOrder: [],
    answered: [],
    roundScores: {}
  };

  rooms.set(id, room);
  return { room, playerId: player.id };
}

export function joinRoom(
  id: string,
  nickname: string,
  lang: Language = 'tr'
): { room: QuizRoom; playerId: string } {
  const room = rooms.get(id.toUpperCase());

  if (!room) {
    throw new Error(t(lang, 'roomNotFound'));
  }
  if (room.players.length >= MAX_PLAYERS) {
    throw new Error(t(lang, 'roomFull'));
  }
  if (room.status !== 'lobby') {
    throw new Error(t(lang, 'gameStarted'));
  }

  // Auto-balance teams in team mode
  const team = room.mode === 'team'
    ? (room.players.filter(p => p.team === 'A').length <=
       room.players.filter(p => p.team === 'B').length ? 'A' : 'B')
    : undefined;

  const player: Player = {
    id: randomUUID(),
    nickname,
    isHost: false,
    team,
    avatar: AVATARS[room.players.length],
    score: 0,
    streak: 0,
    connected: true
  };

  room.players.push(player);
  return { room, playerId: player.id };
}

export function getRoom(id: string): QuizRoom | undefined {
  return rooms.get(id);
}

// Question sanitization (remove correct answers before sending to client)
export function publicQuestion(question: Question): Question {
  const copy = structuredClone(question) as Record<string, unknown>;

  // Remove answer fields
  const answerKeys = [
    'correct_answer',
    'correct_answers',
    'correct_formation',
    'correct_order',
    'correct_matches',
    'answer'
  ];

  for (const key of answerKeys) {
    delete copy[key];
  }

  // Special handling for lightning rounds
  if (copy.type === 'lightning' && Array.isArray(copy.questions)) {
    copy.questions = (copy.questions as unknown[]).map((item) => {
      if (Array.isArray(item)) {
        return { question: String(item[0] ?? '') };
      }
      const entry = item as Record<string, unknown>;
      return { question: String(entry.question ?? '') };
    });
  }

  return copy as Question;
}

export function publicRoom(room: QuizRoom): QuizRoom {
  return {
    ...room,
    question: room.question ? publicQuestion(room.question) : undefined
  };
}

// Game flow
export function startGame(
  room: QuizRoom,
  playerId: string,
  lang: Language = 'tr'
): ReturnType<typeof startRound> {
  if (room.hostId !== playerId) {
    throw new Error(t(lang, 'onlyHostCanStart'));
  }
  if (room.players.length < MIN_PLAYERS) {
    throw new Error(t(lang, 'minTwoPlayers'));
  }

  room.status = 'playing';
  room.currentRound = 1;
  room.questionOrder = shuffle(questions)
    .slice(0, room.totalRounds)
    .map(q => q.id);

  return startRound(room);
}

export function startRound(room: QuizRoom) {
  const questionId = room.questionOrder?.[room.currentRound - 1];
  const question = questionId
    ? questions.find(q => q.id === questionId)
    : undefined;

  const q = question ?? questions[(room.currentRound - 1) % questions.length];
  const now = Date.now();

  room.question = q;
  room.roundStartedAt = now;
  room.roundDeadline = now + q.time_limit * 1000;
  room.answered = [];
  room.roundScores = {};

  return {
    currentRound: room.currentRound,
    question: publicQuestion(q),
    totalRounds: room.totalRounds,
    serverNow: now,
    deadline: room.roundDeadline
  };
}

// Answer scoring
function scoreAnswer(question: Question, answer: unknown): { points: number; correct: boolean } {
  if (!answer) {
    return { points: 0, correct: false };
  }

  switch (question.type) {
    case 'multiple_choice':
      return scoreMultipleChoice(question, answer);

    case 'lightning':
      return scoreLightning(question, answer);

    case 'top_5':
      return scoreTop5(question, answer);

    case 'stat_detective':
      return scoreStatDetective(question, answer);

    case 'formation_builder':
      return scoreFormation(question, answer);

    case 'career_path':
      return scoreCareerPath(question, answer);

    case 'match_maker':
      return scoreMatchMaker(question, answer);

    default:
      return { points: 0, correct: false };
  }
}

function scoreMultipleChoice(
  question: Extract<Question, { type: 'multiple_choice' }>,
  answer: unknown
): { points: number; correct: boolean } {
  const correct = normalize(answer) === normalize(question.correct_answer);
  return {
    points: correct ? question.points : 0,
    correct
  };
}

function scoreLightning(
  question: Extract<Question, { type: 'lightning' }>,
  answer: unknown
): { points: number; correct: boolean } {
  const answers = Array.isArray(answer) ? answer : [];
  const correctCount = answers.filter((x, i) => {
    const item = question.questions[i] as
      | { question?: string; answer?: boolean }
      | [string, boolean]
      | undefined;
    const expected = Array.isArray(item) ? item[1] : item?.answer;
    return x === expected;
  }).length;

  return {
    points: correctCount * question.points_per_correct * question.multiplier,
    correct: correctCount === question.questions.length
  };
}

function scoreTop5(
  question: Extract<Question, { type: 'top_5' }>,
  answer: unknown
): { points: number; correct: boolean } {
  const answers = Array.isArray(answer) ? answer : [];
  const correctCount = answers.filter(x =>
    question.correct_answers.some(y => normalize(y) === normalize(x))
  ).length;

  return {
    points: correctCount * question.points_per_answer,
    correct: correctCount === question.correct_answers.length
  };
}

function scoreStatDetective(
  question: Extract<Question, { type: 'stat_detective' }>,
  answer: unknown
): { points: number; correct: boolean } {
  const correct = normalize(answer) === normalize(question.correct_answer);
  return {
    points: correct ? 150 : 0,
    correct
  };
}

function scoreFormation(
  question: Extract<Question, { type: 'formation_builder' }>,
  answer: unknown
): { points: number; correct: boolean } {
  const answers = (answer && typeof answer === 'object' ? answer : {}) as Record<string, unknown>;
  const correctCount = Object.keys(question.correct_formation).filter(
    k => normalize(answers[k]) === normalize(question.correct_formation[k])
  ).length;

  return {
    points: Math.floor((correctCount / 11) * question.points),
    correct: correctCount === 11
  };
}

function scoreCareerPath(
  question: Extract<Question, { type: 'career_path' }>,
  answer: unknown
): { points: number; correct: boolean } {
  const answers = Array.isArray(answer) ? answer : [];
  const correct =
    answers.length === question.correct_order.length &&
    answers.every((x, i) => x === question.correct_order[i]);

  return {
    points: correct ? question.points : 0,
    correct
  };
}

function scoreMatchMaker(
  question: Extract<Question, { type: 'match_maker' }>,
  answer: unknown
): { points: number; correct: boolean } {
  const answers = (answer && typeof answer === 'object' ? answer : {}) as Record<string, unknown>;
  const total = Object.keys(question.correct_matches).length;
  const correctCount = Object.keys(question.correct_matches).filter(
    k => normalize(answers[k]) === normalize(question.correct_matches[k])
  ).length;

  return {
    points: Math.floor((correctCount / total) * question.points),
    correct: correctCount === total
  };
}

// Submit answer with server-side validation
export function submitAnswer(
  room: QuizRoom,
  playerId: string,
  answer: unknown,
  lang: Language = 'tr'
): QuizAnswer {
  if (!room.question || room.status !== 'playing') {
    throw new Error(t(lang, 'noActiveQuestion'));
  }

  // Server-side deadline check
  if (room.roundDeadline && Date.now() > room.roundDeadline) {
    throw new Error(t(lang, 'answerTooLate'));
  }

  if (room.answered.some(a => a.playerId === playerId)) {
    throw new Error(t(lang, 'alreadyAnswered'));
  }

  const player = room.players.find(p => p.id === playerId);
  if (!player) {
    throw new Error(t(lang, 'playerNotFound'));
  }

  // Score the answer
  const result = scoreAnswer(room.question, answer);

  // Update streak
  if (result.correct) {
    player.streak++;
  } else {
    player.streak = 0;
  }

  // Calculate bonuses
  const basePoints = result.points;
  const placeBonus = calculatePlaceBonus(room, result.correct);
  const streakBonus = result.correct && player.streak >= 3 ? 0.5 : 0;
  const earnedPoints = Math.floor(basePoints * (1 + placeBonus + streakBonus));

  // Update scores
  player.score += earnedPoints;
  room.roundScores[playerId] = earnedPoints;

  const quizAnswer: QuizAnswer = {
    playerId,
    answer,
    submittedAt: Date.now(),
    pointsEarned: earnedPoints,
    correct: result.correct
  };

  room.answered.push(quizAnswer);
  return quizAnswer;
}

function calculatePlaceBonus(room: QuizRoom, isCorrect: boolean): number {
  if (!isCorrect) return 0;

  const correctAnswersCount = room.answered.filter(a => a.correct).length;

  switch (correctAnswersCount) {
    case 0: return 0.3; // First correct answer: +30%
    case 1: return 0.2; // Second: +20%
    case 2: return 0.1; // Third: +10%
    default: return 0;
  }
}

// End round
export function endRound(room: QuizRoom, playerId: string, lang: Language = 'tr') {
  if (room.hostId !== playerId) {
    throw new Error(t(lang, 'onlyHostCanEnd'));
  }
  if (room.status !== 'playing') {
    throw new Error(t(lang, 'roundNotActive'));
  }

  const rankings = [...room.players]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({
      id: p.id,
      name: p.nickname,
      score: p.score,
      rank: i + 1,
      roundScore: room.roundScores[p.id] ?? 0
    }));

  const result = {
    round: room.currentRound,
    question: publicQuestion(room.question!),
    answers: room.answered.map(a => ({ ...a, answer: undefined })),
    rankings
  };

  room.status = 'results';
  return result;
}

// Next round or finish game
export function nextRound(room: QuizRoom, playerId: string, lang: Language = 'tr') {
  if (room.hostId !== playerId) {
    throw new Error(t(lang, 'onlyHostCanNext'));
  }
  if (room.status !== 'results') {
    throw new Error(t(lang, 'notOnResults'));
  }

  // Check if game is finished
  if (room.currentRound >= room.totalRounds) {
    room.status = 'finished';
    const finalRankings = [...room.players]
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({
        id: p.id,
        name: p.nickname,
        score: p.score,
        rank: i + 1
      }));

    return {
      finished: true,
      finalRankings
    };
  }

  // Start next round
  room.currentRound++;
  room.status = 'playing';
  return {
    finished: false,
    ...startRound(room)
  };
}

// Handle disconnections
export function removeSocket(socketId: string, lang: Language = 'tr') {
  for (const [id, room] of rooms) {
    const player = room.players.find(p => p.id === socketId);

    if (player) {
      if (player.isHost) {
        // Host left - delete room
        rooms.delete(id);
        return { roomId: id, hostGone: true };
      }

      // Regular player left - mark as disconnected
      player.connected = false;
      return { roomId: id, hostGone: false };
    }
  }

  return undefined;
}
