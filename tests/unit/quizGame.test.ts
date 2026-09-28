import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoom, joinRoom, startGame, submitAnswer, nextRound } from '../../server/quizGame';

describe('quizGame', () => {
  describe('createRoom and joinRoom', () => {
    it('creates a room with the host player', () => {
      const { room, playerId } = createRoom('Alice', 'solo');

      expect(room.players).toHaveLength(1);
      expect(room.players[0].nickname).toBe('Alice');
      expect(room.players[0].isHost).toBe(true);
      expect(room.hostId).toBe(playerId);
      expect(room.status).toBe('lobby');
    });

    it('allows joining up to 6 players', () => {
      const { room } = createRoom('Player1', 'team');

      joinRoom(room.id, 'Player2');
      joinRoom(room.id, 'Player3');
      joinRoom(room.id, 'Player4');
      joinRoom(room.id, 'Player5');
      joinRoom(room.id, 'Player6');

      expect(room.players).toHaveLength(6);
    });

    it('rejects 7th player', () => {
      const { room } = createRoom('P1', 'solo');

      joinRoom(room.id, 'P2');
      joinRoom(room.id, 'P3');
      joinRoom(room.id, 'P4');
      joinRoom(room.id, 'P5');
      joinRoom(room.id, 'P6');

      expect(() => joinRoom(room.id, 'P7')).toThrow('Oda dolu');
    });

    it('rejects joining after game starts', () => {
      const { room, playerId } = createRoom('Host', 'solo');
      joinRoom(room.id, 'Player2');

      startGame(room, playerId);

      expect(() => joinRoom(room.id, 'Player3')).toThrow('Oyun başlamış');
    });
  });

  describe('startGame', () => {
    it('rejects non-host starting the game', () => {
      const { room } = createRoom('Host', 'solo');
      const { playerId: player2Id } = joinRoom(room.id, 'Player2');

      expect(() => startGame(room, player2Id)).toThrow('Yalnızca host oyunu başlatabilir');
    });

    it('rejects starting with less than 2 players', () => {
      const { room, playerId } = createRoom('Solo', 'solo');

      expect(() => startGame(room, playerId)).toThrow('En az 2 oyuncu gerekli');
    });

    it('starts game with 2+ players', () => {
      const { room, playerId } = createRoom('Host', 'solo');
      joinRoom(room.id, 'Player2');

      const result = startGame(room, playerId);

      expect(room.status).toBe('playing');
      expect(room.currentRound).toBe(1);
      expect(result.currentRound).toBe(1);
      expect(result.question).toBeDefined();
    });
  });

  describe('submitAnswer', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('rejects second answer from same player', () => {
      const { room, playerId } = createRoom('Host', 'solo');
      const { playerId: p2Id } = joinRoom(room.id, 'Player2');

      startGame(room, playerId);
      submitAnswer(room, playerId, 'Answer 1');

      expect(() => submitAnswer(room, playerId, 'Answer 2')).toThrow('Cevabın zaten gönderildi');
    });

    it('rejects answer after deadline', () => {
      const { room, playerId } = createRoom('Host', 'solo');
      joinRoom(room.id, 'Player2');

      const gameState = startGame(room, playerId);
      const timeLimit = gameState.question.time_limit * 1000;

      vi.advanceTimersByTime(timeLimit + 1000);

      expect(() => submitAnswer(room, playerId, 'Late answer')).toThrow('Süre doldu');
    });

    it('accepts answer before deadline', () => {
      const { room, playerId } = createRoom('Host', 'solo');
      joinRoom(room.id, 'Player2');

      const gameState = startGame(room, playerId);
      const timeLimit = gameState.question.time_limit * 1000;

      vi.advanceTimersByTime(timeLimit - 1000);

      expect(() => submitAnswer(room, playerId, 'On time')).not.toThrow();
    });
  });

  describe('nextRound', () => {
    it('finishes after totalRounds', () => {
      const { room, playerId } = createRoom('Host', 'solo');
      joinRoom(room.id, 'Player2');

      startGame(room, playerId);
      room.status = 'results';

      // Advance to final round
      room.currentRound = room.totalRounds;

      const result = nextRound(room, playerId);

      expect(result.finished).toBe(true);
      expect(room.status).toBe('finished');
      expect(result.finalRankings).toBeDefined();
    });

    it('continues to next round when not finished', () => {
      const { room, playerId } = createRoom('Host', 'solo');
      joinRoom(room.id, 'Player2');

      startGame(room, playerId);
      room.status = 'results';
      room.currentRound = 1;

      const result = nextRound(room, playerId);

      expect(result.finished).toBe(false);
      expect(room.currentRound).toBe(2);
      expect(room.status).toBe('playing');
    });
  });
});
