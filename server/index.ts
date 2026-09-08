import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import 'dotenv/config';
import type { Room, Team, Player, Phase, MatchResult } from '../src/types';
import { getShuffledPool } from '../src/playerPool';
import { simulateMatch as runMatchSimulation } from './matchSimulator';
import { BotAI } from './botAI';
import { canAddPlayer, getPositionStats } from './positionLimits';

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// In-memory room storage
const rooms = new Map<string, Room>();

// Generate room ID
function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Create initial team
function createTeam(id: string, name: string): Team {
  return {
    id,
    name,
    budget: 100,
    roster: [],
    ready: false,
    scouts: 3,
    buff: 0
  };
}

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Create room
  socket.on('create_room', ({ nickname }, callback) => {
    const roomId = generateRoomId();
    const playerTeam = createTeam(socket.id, nickname || 'Oyuncu');

    const room: Room = {
      id: roomId,
      teams: [playerTeam],
      phase: 'lobby',
      currentPlayerIndex: 0,
      auctionPool: getShuffledPool(150)
    };

    rooms.set(roomId, room);
    socket.join(roomId);

    callback({ success: true, roomId, room });
    io.to(roomId).emit('room_updated', room);
  });

  // Join room
  socket.on('join_room', ({ roomId, nickname }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback({ success: false, error: 'Oda bulunamadı' });
      return;
    }

    // Check if player is already in the room
    const existingTeam = room.teams.find(t => t.id === socket.id);
    if (existingTeam) {
      socket.join(roomId);
      callback({ success: true, room });
      return;
    }

    // Check if room is full (max 2 players)
    if (room.teams.length >= 2) {
      callback({ success: false, error: 'Oda dolu' });
      return;
    }

    // Add new player
    const newTeam = createTeam(socket.id, nickname || 'Oyuncu 2');
    room.teams.push(newTeam);

    socket.join(roomId);
    callback({ success: true, room });
    io.to(roomId).emit('room_updated', room);
    io.to(roomId).emit('player_joined', { teamName: newTeam.name });
  });

  // Start game
  socket.on('start_game', ({ roomId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback({ success: false, error: 'Oda bulunamadı' });
      return;
    }

    // Check if we have 2 players, if not add a bot
    if (room.teams.length < 2) {
      const botTeam = createTeam('bot', 'Bot Atlas');
      botTeam.ready = true;
      room.teams.push(botTeam);
    }

    room.phase = 'auction';
    room.currentPlayerIndex = 0;

    // Initialize market mechanics
    room.marketTrend = 'stable';

    // Pick 3-5 random upcoming stars to leak
    const starPlayers = room.auctionPool
      .filter(p => p.marketTier === 'star' || p.marketTier === 'high')
      .slice(0, 20);
    const leakCount = Math.floor(Math.random() * 3) + 3; // 3-5 players
    room.upcomingStars = [];
    for (let i = 0; i < leakCount && i < starPlayers.length; i++) {
      const randomIndex = Math.floor(Math.random() * starPlayers.length);
      const player = starPlayers[randomIndex];
      if (!room.upcomingStars.includes(player.id)) {
        room.upcomingStars.push(player.id);
      }
    }

    callback({ success: true });
    io.to(roomId).emit('phase_changed', { phase: 'auction', currentPlayer: room.auctionPool[0] });
    io.to(roomId).emit('market_gossip', {
      message: `📰 Transfer dedikoduları: ${leakCount} yıldız oyuncu havuzda olacak!`,
      stars: room.upcomingStars.map(id => room.auctionPool.find(p => p.id === id)?.name).filter(Boolean)
    });
    io.to(roomId).emit('room_updated', room);
  });

  // Place bid
  socket.on('place_bid', ({ roomId, amount }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback({ success: false, error: 'Oda bulunamadı' });
      return;
    }

    const playerTeam = room.teams.find(t => t.id === socket.id);
    if (!playerTeam) {
      callback({ success: false, error: 'Takım bulunamadı' });
      return;
    }

    const currentPlayer = room.auctionPool[room.currentPlayerIndex];
    if (!currentPlayer) {
      callback({ success: false, error: 'Oyuncu bulunamadı' });
      return;
    }

    // Check budget reserve (must keep enough for remaining slots)
    const slotsRemaining = 14 - playerTeam.roster.length;
    if (amount > playerTeam.budget - (slotsRemaining - 1)) {
      callback({ success: false, error: 'Bu teklif kadro rezervini ihlal ediyor' });
      return;
    }

    // Check position limits
    const positionCheck = canAddPlayer(playerTeam, currentPlayer);
    if (!positionCheck.allowed) {
      callback({ success: false, error: positionCheck.reason });
      return;
    }

    // Add player to roster
    playerTeam.budget -= amount;
    playerTeam.roster.push(currentPlayer);

    // Bot makes intelligent decision
    const botTeam = room.teams.find(t => t.id === 'bot');
    if (botTeam && botTeam.roster.length < 14) {
      const botAI = new BotAI(botTeam);
      const botPlayerIndex = room.currentPlayerIndex + 1;
      const botPlayer = room.auctionPool[botPlayerIndex];

      if (botPlayer) {
        const botPositionCheck = canAddPlayer(botTeam, botPlayer);
        if (botAI.shouldBid(botPlayer) && botPositionCheck.allowed) {
          const botBidAmount = botAI.calculateBid(botPlayer);
          botTeam.budget -= botBidAmount;
          botTeam.roster.push(botPlayer);
        }
      }
    }

    // Move to next player
    room.currentPlayerIndex += 2;

    // Market dynamics: every 4 picks, chance of market shift
    if (room.currentPlayerIndex % 8 === 0 && Math.random() < 0.4) {
      const trends = ['boom', 'crash', 'stable'] as const;
      const oldTrend = room.marketTrend || 'stable';
      room.marketTrend = trends[Math.floor(Math.random() * trends.length)];

      if (room.marketTrend !== oldTrend) {
        const trendMessages = {
          boom: '📈 Piyasa canlanıyor! Oyuncu değerleri yükselişte!',
          crash: '📉 Piyasa durgunlaştı. Fırsatlar çıkabilir!',
          stable: '💼 Piyasa dengelendi.'
        };
        io.to(roomId).emit('market_shift', {
          trend: room.marketTrend,
          message: trendMessages[room.marketTrend]
        });
      }
    }

    // Check if auction phase is complete
    if (playerTeam.roster.length >= 14) {
      room.phase = 'steal';
      io.to(roomId).emit('phase_changed', { phase: 'steal' });
    } else {
      const nextPlayer = room.auctionPool[room.currentPlayerIndex];
      io.to(roomId).emit('player_acquired', { player: currentPlayer, amount });
      io.to(roomId).emit('next_player', { player: nextPlayer });
    }

    callback({ success: true });
    io.to(roomId).emit('room_updated', room);
  });

  // Skip player
  socket.on('skip_player', ({ roomId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback({ success: false, error: 'Oda bulunamadı' });
      return;
    }

    room.currentPlayerIndex += 1;
    const nextPlayer = room.auctionPool[room.currentPlayerIndex];

    callback({ success: true });
    io.to(roomId).emit('next_player', { player: nextPlayer });
    io.to(roomId).emit('room_updated', room);
  });

  // Use scout
  socket.on('use_scout', ({ roomId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback({ success: false, error: 'Oda bulunamadı' });
      return;
    }

    const playerTeam = room.teams.find(t => t.id === socket.id);
    if (!playerTeam) {
      callback({ success: false, error: 'Takım bulunamadı' });
      return;
    }

    if (playerTeam.scouts <= 0) {
      callback({ success: false, error: 'Scout hakkınız kalmadı' });
      return;
    }

    // Scout reveals info about the NEXT player (currentPlayerIndex + 2, since player picks every other)
    const nextPlayerIndex = room.currentPlayerIndex + 2;
    const nextPlayer = room.auctionPool[nextPlayerIndex];

    if (!nextPlayer) {
      callback({ success: false, error: 'Sonraki oyuncu bulunamadı' });
      return;
    }

    playerTeam.scouts -= 1;

    callback({
      success: true,
      tier: nextPlayer.marketTier,
      playerName: nextPlayer.name,
      position: nextPlayer.primaryPosition,
      overall: nextPlayer.baseOverall
    });
    io.to(roomId).emit('room_updated', room);
  });

  // Submit steal choice
  socket.on('submit_steal', ({ roomId, target, offer, protect }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback({ success: false, error: 'Oda bulunamadı' });
      return;
    }

    if (!room.stealChoices) room.stealChoices = {};
    room.stealChoices[socket.id] = { target, offer, protect };

    // Bot also makes steal choice
    const botTeam = room.teams.find(t => t.id === 'bot');
    const playerTeam = room.teams.find(t => t.id === socket.id);

    if (botTeam && playerTeam && !room.stealChoices['bot']) {
      const botAI = new BotAI(botTeam);
      const targetPlayer = botAI.selectStealTarget(playerTeam.roster);
      const offerPlayer = targetPlayer ? botAI.selectOfferPlayer(targetPlayer) : null;
      const protectPlayer = botAI.selectProtectedPlayer();

      room.stealChoices['bot'] = {
        target: targetPlayer?.id || '',
        offer: offerPlayer?.id || '',
        protect: protectPlayer?.id || ''
      };
    }

    // Process steal if all players submitted
    const allSubmitted = room.teams.every(t => room.stealChoices?.[t.id]);

    if (allSubmitted) {
      // Process steal logic
      processStealPhase(room);
      room.phase = 'trade';
      io.to(roomId).emit('phase_changed', { phase: 'trade' });
    }

    callback({ success: true });
    io.to(roomId).emit('room_updated', room);
  });

  // Accept/reject trade
  socket.on('trade_response', ({ roomId, accept }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback({ success: false, error: 'Oda bulunamadı' });
      return;
    }

    // Process trade if accepted
    if (accept && room.tradeOffers && room.tradeOffers.length > 0) {
      const trade = room.tradeOffers[0];
      const fromTeam = room.teams.find(t => t.id === trade.from);
      const toTeam = room.teams.find(t => t.id === trade.to);

      if (fromTeam && toTeam) {
        // Remove players from respective rosters
        fromTeam.roster = fromTeam.roster.filter(p => p.id !== trade.give.id);
        toTeam.roster = toTeam.roster.filter(p => p.id !== trade.want.id);

        // Add players to new rosters
        fromTeam.roster.push(trade.want);
        toTeam.roster.push(trade.give);
      }
    }

    // Bot makes lineup and tactics decisions
    const botTeam = room.teams.find(t => t.id === 'bot');
    if (botTeam) {
      const botAI = new BotAI(botTeam);
      botTeam.formation = botAI.selectFormation();
      botTeam.tactic = botAI.selectTactics();
      botTeam.lineup = {}; // Placeholder - would need proper lineup assignment
    }

    room.phase = 'lineup';
    callback({ success: true });
    io.to(roomId).emit('phase_changed', { phase: 'lineup' });
    io.to(roomId).emit('room_updated', room);
  });

  // Save lineup
  socket.on('save_lineup', ({ roomId, formation, lineup }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback({ success: false, error: 'Oda bulunamadı' });
      return;
    }

    const playerTeam = room.teams.find(t => t.id === socket.id);
    if (!playerTeam) {
      callback({ success: false, error: 'Takım bulunamadı' });
      return;
    }

    playerTeam.formation = formation;
    playerTeam.lineup = lineup;

    room.phase = 'tactics';
    callback({ success: true });
    io.to(roomId).emit('phase_changed', { phase: 'tactics' });
    io.to(roomId).emit('room_updated', room);
  });

  // Save tactics
  socket.on('save_tactics', ({ roomId, tactic }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback({ success: false, error: 'Oda bulunamadı' });
      return;
    }

    const playerTeam = room.teams.find(t => t.id === socket.id);
    if (!playerTeam) {
      callback({ success: false, error: 'Takım bulunamadı' });
      return;
    }

    playerTeam.tactic = tactic;

    callback({ success: true });
    io.to(roomId).emit('room_updated', room);
  });

  // Simulate match
  socket.on('simulate_match', ({ roomId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback({ success: false, error: 'Oda bulunamadı' });
      return;
    }

    room.phase = 'match';
    io.to(roomId).emit('phase_changed', { phase: 'match' });

    // Simulate match
    setTimeout(() => {
      const result = runMatchSimulation({
        team1: room.teams[0],
        team2: room.teams[1],
        seed: Date.now()
      });
      room.matchResult = result;
      room.phase = 'result';

      io.to(roomId).emit('match_result', result);
      io.to(roomId).emit('phase_changed', { phase: 'result' });
      io.to(roomId).emit('room_updated', room);
    }, 3000);

    callback({ success: true });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Process steal phase logic
function processStealPhase(room: Room) {
  if (!room.stealChoices) return;

  // Each team tries to steal from opponent
  for (const team of room.teams) {
    const choice = room.stealChoices[team.id];
    if (!choice) continue;

    // Find opponent team
    const opponent = room.teams.find(t => t.id !== team.id);
    if (!opponent) continue;

    const opponentChoice = room.stealChoices[opponent.id];
    if (!opponentChoice) continue;

    // Check if target is protected
    const targetPlayer = opponent.roster.find(p => p.id === choice.target);
    if (!targetPlayer) continue;

    // If target is protected by opponent, steal fails
    if (opponentChoice.protect === choice.target) {
      continue;
    }

    // Successful steal - swap players
    const offerPlayer = team.roster.find(p => p.id === choice.offer);
    if (!offerPlayer) continue;

    // Remove players from rosters
    team.roster = team.roster.filter(p => p.id !== offerPlayer.id);
    opponent.roster = opponent.roster.filter(p => p.id !== targetPlayer.id);

    // Add players to new rosters
    team.roster.push(targetPlayer);
    opponent.roster.push(offerPlayer);

    // Generate trade offer for next phase
    if (!room.tradeOffers) room.tradeOffers = [];
    room.tradeOffers.push({
      from: team.id,
      to: opponent.id,
      give: targetPlayer,
      want: offerPlayer
    });
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: rooms.size });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
