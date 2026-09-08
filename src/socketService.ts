import { io, Socket } from 'socket.io-client';
import type { Room, Player } from './types';

class SocketService {
  private socket: Socket | null = null;

  connect() {
    if (!this.socket) {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://127.0.0.1:3001';
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  createRoom(nickname: string, maxPlayers: number, competition: string): Promise<{ success: boolean; roomId?: string; room?: Room; error?: string }> {
    return new Promise((resolve) => {
      this.socket?.emit('create_room', { nickname, maxPlayers, competition }, (response: any) => {
        resolve(response);
      });
    });
  }

  joinRoom(roomId: string, nickname: string): Promise<{ success: boolean; room?: Room; error?: string }> {
    return new Promise((resolve) => {
      this.socket?.emit('join_room', { roomId, nickname }, (response: any) => {
        resolve(response);
      });
    });
  }

  startGame(roomId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket?.emit('start_game', { roomId }, (response: any) => {
        resolve(response);
      });
    });
  }

  placeBid(roomId: string, amount: number): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket?.emit('place_bid', { roomId, amount }, (response: any) => {
        resolve(response);
      });
    });
  }

  skipPlayer(roomId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket?.emit('skip_player', { roomId }, (response: any) => {
        resolve(response);
      });
    });
  }

  useScout(roomId: string): Promise<{ success: boolean; tier?: string; playerName?: string; position?: string; overall?: number; error?: string }> {
    return new Promise((resolve) => {
      this.socket?.emit('use_scout', { roomId }, (response: any) => {
        resolve(response);
      });
    });
  }

  submitSteal(roomId: string, target: string, offer: string, protect: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket?.emit('submit_steal', { roomId, target, offer, protect }, (response: any) => {
        resolve(response);
      });
    });
  }

  tradeResponse(roomId: string, accept: boolean): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket?.emit('trade_response', { roomId, accept }, (response: any) => {
        resolve(response);
      });
    });
  }

  saveLineup(roomId: string, formation: string, lineup: Record<string, string>): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket?.emit('save_lineup', { roomId, formation, lineup }, (response: any) => {
        resolve(response);
      });
    });
  }

  saveTactics(roomId: string, tactic: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket?.emit('save_tactics', { roomId, tactic }, (response: any) => {
        resolve(response);
      });
    });
  }

  simulateMatch(roomId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket?.emit('simulate_match', { roomId }, (response: any) => {
        resolve(response);
      });
    });
  }

  onRoomUpdated(callback: (room: Room) => void) {
    this.socket?.on('room_updated', callback);
  }

  onPhaseChanged(callback: (data: { phase: string; currentPlayer?: Player }) => void) {
    this.socket?.on('phase_changed', callback);
  }

  onNextPlayer(callback: (data: { player: Player }) => void) {
    this.socket?.on('next_player', callback);
  }

  onPlayerAcquired(callback: (data: { player: Player; amount: number }) => void) {
    this.socket?.on('player_acquired', callback);
  }

  onMatchResult(callback: (result: any) => void) {
    this.socket?.on('match_result', callback);
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string) {
    this.socket?.off(event);
  }
}

export const socketService = new SocketService();
