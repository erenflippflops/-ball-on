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
const auctionTimers = new Map<string, NodeJS.Timeout>();

// Auction timer function
function startAuctionTimer(roomId: string, io: Server) {
  // Clear existing timer if any
  const existingTimer = auctionTimers.get(roomId);
  if (existingTimer) {
    clearInterval(existingTimer);
  }

  const room = rooms.get(roomId);
  if (!room || !room.auctionState) return;

  // Emit timer updates every second
  const timer = setInterval(() => {
    const room = rooms.get(roomId);
    if (!room || !room.auctionState) {
      clearInterval(timer);
      auctionTimers.delete(roomId);
      return;
    }

    const elapsed = Math.floor((Date.now() - room.auctionState.timerStarted) / 1000);
    room.auctionState.timeLeft = Math.max(0, 30 - elapsed);

    // Emit timer update
    io.to(roomId).emit('auction_timer', { timeLeft: room.auctionState.timeLeft });

    // Timer finished
    if (room.auctionState.timeLeft <= 0) {
      clearInterval(timer);
      auctionTimers.delete(roomId);
      finalizeAuction(roomId, io);
    }
  }, 1000);

  auctionTimers.set(roomId, timer);
}

// Finalize auction - award player to highest bidder
function finalizeAuction(roomId: string, io: Server) {
  const room = rooms.get(roomId);
  if (!room || !room.auctionState) return;

  const currentPlayer = room.auctionPool[room.currentPlayerIndex];
  if (!currentPlayer) return;

  // Collect all bidders info
  const allBidders = Object.entries(room.auctionState.currentBids).map(([teamId, amount]) => {
    const team = room.teams.find(t => t.id === teamId);
    return { teamName: team?.name || 'Unknown', amount };
  });

  // Award player to highest bidder
  if (room.auctionState.highestBidder) {
    const winnerTeam = room.teams.find(t => t.id === room.auctionState!.highestBidder);
    if (winnerTeam) {
      winnerTeam.budget -= room.auctionState.highestBid;
      winnerTeam.roster.push(currentPlayer);

      // Apply joker bonus if player has one
      let jokerBonus = null;
      if (currentPlayer.joker && !currentPlayer.joker.revealed) {
        currentPlayer.joker.revealed = true;
        jokerBonus = currentPlayer.joker;

        switch (jokerBonus.type) {
          case 'budget':
            winnerTeam.budget += jokerBonus.value;
            break;
          case 'scout':
            winnerTeam.scouts += jokerBonus.value;
            break;
          case 'buff':
            winnerTeam.buff += jokerBonus.value;
            break;
        }
      }

      io.to(roomId).emit('player_acquired', {
        player: currentPlayer,
        amount: room.auctionState.highestBid,
        winner: winnerTeam.name,
        allBidders,
        joker: jokerBonus
      });
    }
  } else {
    // No bids - assign to random team for free
    const eligibleTeams = room.teams.filter(t => {
      if (t.roster.length >= 14) return false;
      const positionCheck = canAddPlayer(t, currentPlayer);
      return positionCheck.allowed;
    });

    if (eligibleTeams.length > 0) {
      const randomTeam = eligibleTeams[Math.floor(Math.random() * eligibleTeams.length)];
      randomTeam.roster.push(currentPlayer);

      // Apply joker bonus even for free transfers
      let jokerBonus = null;
      if (currentPlayer.joker && !currentPlayer.joker.revealed) {
        currentPlayer.joker.revealed = true;
        jokerBonus = currentPlayer.joker;

        switch (jokerBonus.type) {
          case 'budget':
            randomTeam.budget += jokerBonus.value;
            break;
          case 'scout':
            randomTeam.scouts += jokerBonus.value;
            break;
          case 'buff':
            randomTeam.buff += jokerBonus.value;
            break;
        }
      }

      io.to(roomId).emit('player_acquired', {
        player: currentPlayer,
        amount: 0,
        winner: randomTeam.name,
        free: true,
        joker: jokerBonus
      });
      io.to(roomId).emit('message', {
        text: `Hiç teklif verilmedi! ${currentPlayer.name} rastgele ${randomTeam.name} takımına ücretsiz gitti.`
      });
    } else {
      // No eligible team - player skipped
      io.to(roomId).emit('player_skipped', { player: currentPlayer });
    }
  }

  // Move to next player
  room.currentPlayerIndex++;

  // Check if all players have roster of 14
  const allComplete = room.teams.every(t => t.roster.length >= 14);

  if (allComplete) {
    // Move to steal phase
    room.phase = 'steal';
    io.to(roomId).emit('phase_changed', { phase: 'steal' });
  } else {
    // Start next auction
    const nextPlayer = room.auctionPool[room.currentPlayerIndex];
    if (nextPlayer) {
      room.auctionState = {
        currentBids: {},
        highestBidder: null,
        highestBid: 0,
        timeLeft: 30,
        timerStarted: Date.now(),
        skippedPlayers: []
      };

      // Bot auto-bid logic
      const botTeams = room.teams.filter(t => t.id.startsWith('bot'));
      botTeams.forEach(botTeam => {
        if (botTeam.roster.length < 14) {
          const botAI = new BotAI(botTeam);
          const positionCheck = canAddPlayer(botTeam, nextPlayer);

          if (botAI.shouldBid(nextPlayer) && positionCheck.allowed) {
            setTimeout(() => {
              const botBid = botAI.calculateBid(nextPlayer);
              const slotsRemaining = 14 - botTeam.roster.length;

              if (botBid <= botTeam.budget - (slotsRemaining - 1)) {
                const room = rooms.get(roomId);
                if (room && room.auctionState && botBid > room.auctionState.highestBid) {
                  room.auctionState.currentBids[botTeam.id] = botBid;
                  room.auctionState.highestBid = botBid;
                  room.auctionState.highestBidder = botTeam.id;

                  io.to(roomId).emit('bid_placed', {
                    teamName: botTeam.name,
                    amount: botBid,
                    highestBid: botBid,
                    highestBidder: botTeam.name
                  });
                  io.to(roomId).emit('room_updated', room);

                  // Check if all players decided after bot bid
                  const allTeams = room.teams;
                  const allBidders = Object.keys(room.auctionState!.currentBids);
                  const allSkippers = room.auctionState!.skippedPlayers;
                  const allDecided = allTeams.length === (allBidders.length + allSkippers.length);

                  if (allDecided && allBidders.length === 1) {
                    const timer = auctionTimers.get(roomId);
                    if (timer) {
                      clearInterval(timer);
                      auctionTimers.delete(roomId);
                    }
                    finalizeAuction(roomId, io);
                  }
                }
              }
            }, Math.random() * 5000 + 2000); // Bot bids after 2-7 seconds
          } else {
            // Bot skips this player immediately
            if (!room.auctionState.skippedPlayers.includes(botTeam.id)) {
              room.auctionState.skippedPlayers.push(botTeam.id);
            }
          }
        } else {
          // Bot roster full, skip
          if (!room.auctionState.skippedPlayers.includes(botTeam.id)) {
            room.auctionState.skippedPlayers.push(botTeam.id);
          }
        }
      });

      io.to(roomId).emit('next_player', { player: nextPlayer });
      startAuctionTimer(roomId, io);
    }
  }

  // Market dynamics check
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

  io.to(roomId).emit('room_updated', room);
}

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
  socket.on('create_room', ({ nickname, maxPlayers, competition }, callback) => {
    const roomId = generateRoomId();
    const playerTeam = createTeam(socket.id, nickname || 'Oyuncu');

    // Validate maxPlayers
    const validMaxPlayers = [2, 4, 6, 8];
    const roomMaxPlayers = validMaxPlayers.includes(maxPlayers) ? maxPlayers : 2;

    const room: Room = {
      id: roomId,
      teams: [playerTeam],
      phase: 'lobby',
      currentPlayerIndex: 0,
      auctionPool: getShuffledPool(150),
      maxPlayers: roomMaxPlayers,
      competition: competition || 'Premier League'
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

    // Check if room is full
    if (room.teams.length >= room.maxPlayers) {
      callback({ success: false, error: 'Oda dolu' });
      return;
    }

    // Add new player
    const playerNumber = room.teams.length + 1;
    const newTeam = createTeam(socket.id, nickname || `Oyuncu ${playerNumber}`);
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

    // Fill room with bots up to maxPlayers count
    const currentPlayerCount = room.teams.length;
    const botsNeeded = room.maxPlayers - currentPlayerCount;

    if (botsNeeded > 0) {
      const botNames = ['Bot Atlas', 'Bot Olympos', 'Bot Sparta', 'Bot Nemesis', 'Bot Titan', 'Bot Kronos', 'Bot Zeus'];

      for (let i = 0; i < botsNeeded; i++) {
        const botName = botNames[i] || `Bot ${i + 1}`;
        const botTeam = createTeam(`bot-${currentPlayerCount + i}`, botName);
        botTeam.ready = true;
        room.teams.push(botTeam);
      }
    }

    room.phase = 'auction';
    room.currentPlayerIndex = 0;

    // Initialize auction state
    room.auctionState = {
      currentBids: {},
      highestBidder: null,
      highestBid: 0,
      timeLeft: 30,
      timerStarted: Date.now(),
      skippedPlayers: []
    };

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

    // Start auction timer
    startAuctionTimer(roomId, io);

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

    if (!room.auctionState) {
      callback({ success: false, error: 'Açık artırma durumu bulunamadı' });
      return;
    }

    // Check budget reserve
    const slotsRemaining = 14 - playerTeam.roster.length;
    if (amount > playerTeam.budget - (slotsRemaining - 1)) {
      callback({ success: false, error: 'Bu teklif kadro rezervini ihlal ediyor' });
      return;
    }

    // Check if bid is higher than current highest
    if (amount <= room.auctionState.highestBid) {
      callback({ success: false, error: `En az ${room.auctionState.highestBid + 1} CR teklif vermelisin` });
      return;
    }

    // Check position limits
    const positionCheck = canAddPlayer(playerTeam, currentPlayer);
    if (!positionCheck.allowed) {
      callback({ success: false, error: positionCheck.reason });
      return;
    }

    // Update auction state
    room.auctionState.currentBids[playerTeam.id] = amount;
    room.auctionState.highestBid = amount;
    room.auctionState.highestBidder = playerTeam.id;

    // Time extension: if less than 5 seconds left, add 3 seconds
    const elapsed = Math.floor((Date.now() - room.auctionState.timerStarted) / 1000);
    const timeLeft = Math.max(0, 30 - elapsed);

    if (timeLeft < 5) {
      // Extend timer by 3 seconds
      room.auctionState.timerStarted = Date.now() - ((30 - timeLeft - 3) * 1000);
      io.to(roomId).emit('time_extended', {
        message: `⏱️ Son saniye teklifi! +3 saniye eklendi`,
        newTimeLeft: timeLeft + 3
      });
    }

    callback({ success: true });
    io.to(roomId).emit('bid_placed', {
      teamName: playerTeam.name,
      amount,
      highestBid: amount,
      highestBidder: playerTeam.name
    });
    io.to(roomId).emit('room_updated', room);

    // Check if all players have decided (either bid or skipped)
    const allTeams = room.teams;
    const allBidders = Object.keys(room.auctionState.currentBids);
    const allSkippers = room.auctionState.skippedPlayers;

    const allDecided = allTeams.length === (allBidders.length + allSkippers.length);

    // Only finalize immediately if there's exactly 1 bidder and others skipped
    if (allDecided && allBidders.length === 1) {
      // One bidder, others skipped - finalize immediately
      const timer = auctionTimers.get(roomId);
      if (timer) {
        clearInterval(timer);
        auctionTimers.delete(roomId);
      }
      finalizeAuction(roomId, io);
    }
  });

  // Skip player - mark as skipped and check if all decided
  socket.on('skip_player', ({ roomId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback({ success: false, error: 'Oda bulunamadı' });
      return;
    }

    if (!room.auctionState) {
      callback({ success: false, error: 'Açık artırma durumu bulunamadı' });
      return;
    }

    const playerTeam = room.teams.find(t => t.id === socket.id);
    if (!playerTeam) {
      callback({ success: false, error: 'Takım bulunamadı' });
      return;
    }

    // Mark this player as skipped
    if (!room.auctionState.skippedPlayers.includes(playerTeam.id)) {
      room.auctionState.skippedPlayers.push(playerTeam.id);
    }

    callback({ success: true });
    io.to(roomId).emit('player_skipped_bid', { teamName: playerTeam.name });

    // Check if all players have decided (either bid or skipped)
    const allTeams = room.teams;
    const allBidders = Object.keys(room.auctionState.currentBids);
    const allSkippers = room.auctionState.skippedPlayers;

    const allDecided = allTeams.length === (allBidders.length + allSkippers.length);

    // Only finalize immediately if there's exactly 1 bidder and others skipped
    if (allDecided && allBidders.length === 1) {
      // One bidder, others skipped - finalize immediately
      const timer = auctionTimers.get(roomId);
      if (timer) {
        clearInterval(timer);
        auctionTimers.delete(roomId);
      }
      finalizeAuction(roomId, io);
    }
    // If no one bid (all skipped), also finalize immediately
    else if (allDecided && allBidders.length === 0) {
      const timer = auctionTimers.get(roomId);
      if (timer) {
        clearInterval(timer);
        auctionTimers.delete(roomId);
      }
      finalizeAuction(roomId, io);
    }
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
        // from gives 'give', to gives 'want'
        // Remove players from respective rosters
        fromTeam.roster = fromTeam.roster.filter(p => p.id !== trade.give.id);
        toTeam.roster = toTeam.roster.filter(p => p.id !== trade.want.id);

        // Add players to new rosters (swap)
        fromTeam.roster.push(trade.want);
        toTeam.roster.push(trade.give);
      }
    }

    // Clear trade offers
    room.tradeOffers = [];

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

  // Clear previous trade offers
  room.tradeOffers = [];

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

    // Successful steal - create trade offer (don't swap yet)
    const offerPlayer = team.roster.find(p => p.id === choice.offer);
    if (!offerPlayer) continue;

    // Generate trade offer for next phase
    room.tradeOffers.push({
      from: team.id,
      to: opponent.id,
      give: offerPlayer,
      want: targetPlayer
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
