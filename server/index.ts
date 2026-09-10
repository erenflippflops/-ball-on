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

// Server with tactic selection phase support
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
    room.auctionState.timeLeft = Math.max(0, 14 - elapsed);

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

  // Check for halftime after ~7 players (first half auction complete)
  if (room.phase === 'first_half_auction' && room.currentPlayerIndex >= 7) {
    // Move to halftime transfer window
    room.phase = 'halftime';
    room.halftimeTimer = 90; // 90 seconds for transfers
    room.marketplace = []; // Initialize empty marketplace
    room.halftimeOffers = [];
    io.to(roomId).emit('phase_changed', { phase: 'halftime' });
    io.to(roomId).emit('room_updated', room);
    return;
  }

  // Check if all players have roster of 14 (second half complete)
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
        timeLeft: 14,
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

    // Move to tactic selection phase instead of directly to auction
    room.phase = 'tactic_selection';

    callback({ success: true });
    io.to(roomId).emit('phase_changed', { phase: 'tactic_selection' });
    io.to(roomId).emit('room_updated', room);
  });

  // Select tactic (Pre-auction)
  socket.on('select_tactic', ({ roomId, tacticId, formation }, callback) => {
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

    // Save chosen tactic and formation
    playerTeam.chosenTactic = tacticId;
    playerTeam.formation = formation;

    callback({ success: true });
    io.to(roomId).emit('room_updated', room);

    // Bots select random tactics after a short delay (2-3 seconds)
    const tacticOptions = ['tiki-taka', 'counter-attack', 'physical-direct', 'high-press', 'wing-play', 'possession'];
    const formationOptions = ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1', '3-4-3'];

    setTimeout(() => {
      const currentRoom = rooms.get(roomId);
      if (!currentRoom || currentRoom.phase !== 'tactic_selection') return;

      currentRoom.teams.forEach(team => {
        if (team.id.startsWith('bot-') && !team.chosenTactic) {
          team.chosenTactic = tacticOptions[Math.floor(Math.random() * tacticOptions.length)];
          team.formation = formationOptions[Math.floor(Math.random() * formationOptions.length)];
        }
      });

      // Check if all teams have selected tactics
      const allSelected = currentRoom.teams.every(t => t.chosenTactic);

      if (allSelected) {
        // Move to first half auction phase
        currentRoom.phase = 'first_half_auction';
        currentRoom.currentPlayerIndex = 0;

        // Initialize auction state
        currentRoom.auctionState = {
          currentBids: {},
          highestBidder: null,
          highestBid: 0,
          timeLeft: 14,
          timerStarted: Date.now(),
          skippedPlayers: []
        };

        // Initialize market mechanics
        currentRoom.marketTrend = 'stable';

        // Pick 3-5 random upcoming stars to leak
        const starPlayers = currentRoom.auctionPool
          .filter(p => p.marketTier === 'star' || p.marketTier === 'high')
          .slice(0, 20);
        const leakCount = Math.floor(Math.random() * 3) + 3; // 3-5 players
        currentRoom.upcomingStars = [];
        for (let i = 0; i < leakCount && i < starPlayers.length; i++) {
          const randomIndex = Math.floor(Math.random() * starPlayers.length);
          const player = starPlayers[randomIndex];
          if (!currentRoom.upcomingStars.includes(player.id)) {
            currentRoom.upcomingStars.push(player.id);
          }
        }

        // Start auction timer
        startAuctionTimer(roomId, io);

        io.to(roomId).emit('phase_changed', { phase: 'first_half_auction', currentPlayer: currentRoom.auctionPool[0] });
        io.to(roomId).emit('market_gossip', {
          message: `📰 Transfer dedikoduları: ${leakCount} yıldız oyuncu havuzda olacak!`,
          stars: currentRoom.upcomingStars.map(id => currentRoom.auctionPool.find(p => p.id === id)?.name).filter(Boolean)
        });
        io.to(roomId).emit('room_updated', currentRoom);
      }
    }, 2500); // 2.5 seconds delay for bots
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
    const timeLeft = Math.max(0, 14 - elapsed);

    if (timeLeft < 5) {
      // Extend timer by 3 seconds
      room.auctionState.timerStarted = Date.now() - ((14 - timeLeft - 3) * 1000);
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

    // Make all bots decide immediately (bid or skip)
    room.teams.forEach(team => {
      if (team.id.startsWith('bot-')) {
        const alreadyBid = room.auctionState!.currentBids[team.id] !== undefined;
        const alreadySkipped = room.auctionState!.skippedPlayers.includes(team.id);

        if (!alreadyBid && !alreadySkipped) {
          const currentPlayer = room.auctionPool[room.currentPlayerIndex];
          const botAI = new BotAI(team);

          if (botAI.shouldBid(currentPlayer)) {
            const bidAmount = botAI.calculateBid(currentPlayer);
            room.auctionState!.currentBids[team.id] = bidAmount;

            if (bidAmount > room.auctionState!.highestBid) {
              room.auctionState!.highestBid = bidAmount;
              room.auctionState!.highestBidder = team.id;
            }

            io.to(roomId).emit('new_bid', {
              teamId: team.id,
              teamName: team.name,
              amount: bidAmount,
              highestBid: room.auctionState!.highestBid,
              highestBidder: room.auctionState!.highestBidder
            });
          } else {
            room.auctionState!.skippedPlayers.push(team.id);
            io.to(roomId).emit('player_skipped_bid', { teamName: team.name });
          }
        }
      }
    });

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

    // All bots make steal choices
    room.teams.forEach(team => {
      if (team.id.startsWith('bot-') && !room.stealChoices![team.id]) {
        const botAI = new BotAI(team);

        // Pick a random opponent
        const opponents = room.teams.filter(t => t.id !== team.id);
        const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];

        const targetPlayer = randomOpponent ? botAI.selectStealTarget(randomOpponent.roster) : null;
        const offerPlayer = targetPlayer ? botAI.selectOfferPlayer(targetPlayer) : null;
        const protectPlayer = botAI.selectProtectedPlayer();

        room.stealChoices![team.id] = {
          target: targetPlayer?.id || '',
          offer: offerPlayer?.id || '',
          protect: protectPlayer?.id || ''
        };
      }
    });

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

    // Track who has responded to trade offers
    if (!room.tradeResponses) {
      room.tradeResponses = new Set<string>();
    }
    room.tradeResponses.add(socket.id);

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

    // Send success callback immediately
    callback({ success: true });

    // Bots automatically respond to trade offers
    room.teams.forEach(team => {
      if (team.id.startsWith('bot-') && !room.tradeResponses?.has(team.id)) {
        room.tradeResponses?.add(team.id);

        // Bot decides whether to accept trade
        if (room.tradeOffers && room.tradeOffers.length > 0) {
          const trade = room.tradeOffers[0];
          if (trade.to === team.id) {
            const botAI = new BotAI(team);
            const shouldAccept = botAI.shouldAcceptTrade(trade.give, trade.want);

            if (shouldAccept) {
              const fromTeam = room.teams.find(t => t.id === trade.from);
              if (fromTeam) {
                fromTeam.roster = fromTeam.roster.filter(p => p.id !== trade.give.id);
                team.roster = team.roster.filter(p => p.id !== trade.want.id);
                fromTeam.roster.push(trade.want);
                team.roster.push(trade.give);
              }
            }
          }
        }
      }
    });

    // Check if all players (human + bots) have responded
    const allResponded = room.teams.every(t => room.tradeResponses?.has(t.id));

    if (allResponded) {
      // Clear trade offers and responses
      room.tradeOffers = [];
      room.tradeResponses = new Set();

      // All bots make lineup and tactics decisions
      room.teams.forEach(team => {
        if (team.id.startsWith('bot-')) {
          const botAI = new BotAI(team);
          team.formation = botAI.selectFormation();
          team.tactic = botAI.selectTactics();
          team.lineup = {}; // Placeholder - would need proper lineup assignment
        }
      });

      // Skip lineup and tactics phases, go directly to match
      room.phase = 'match';
      io.to(roomId).emit('phase_changed', { phase: 'match' });
      io.to(roomId).emit('room_updated', room);
    } else {
      // Send room update to show responses
      io.to(roomId).emit('room_updated', room);
    }
  });

  // Save lineup - deprecated, kept for compatibility
  socket.on('save_lineup', ({ roomId, formation, lineup }, callback) => {
    callback({ success: true });
  });

  // Save tactics - deprecated, kept for compatibility
  socket.on('save_tactics', ({ roomId, tactic }, callback) => {
    callback({ success: true });
  });

  // Finish halftime and move to second half auction
  socket.on('finish_halftime', ({ roomId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback({ success: false, error: 'Oda bulunamadı' });
      return;
    }

    if (room.phase !== 'halftime') {
      callback({ success: false, error: 'Halftime değil' });
      return;
    }

    // Move to second half auction
    room.phase = 'second_half_auction';
    room.halftimeOffers = [];

    // Start second half auction from where we left off
    const nextPlayer = room.auctionPool[room.currentPlayerIndex];
    if (nextPlayer) {
      room.auctionState = {
        currentBids: {},
        highestBidder: null,
        highestBid: 0,
        timeLeft: 14,
        timerStarted: Date.now(),
        skippedPlayers: []
      };

      startAuctionTimer(roomId, io);
      io.to(roomId).emit('phase_changed', { phase: 'second_half_auction', currentPlayer: nextPlayer });
      io.to(roomId).emit('room_updated', room);
    }

    callback({ success: true });
  });

  // Sell player to marketplace
  socket.on('sell_player', ({ roomId, playerId, price }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback({ success: false, error: 'Oda bulunamadı' });
      return;
    }

    if (room.phase !== 'halftime') {
      callback({ success: false, error: 'Sadece devre arasında satış yapılabilir' });
      return;
    }

    const sellerTeam = room.teams.find(t => t.id === socket.id);
    if (!sellerTeam) {
      callback({ success: false, error: 'Takım bulunamadı' });
      return;
    }

    const player = sellerTeam.roster.find(p => p.id === playerId);
    if (!player) {
      callback({ success: false, error: 'Oyuncu bulunamadı' });
      return;
    }

    // Add to marketplace
    if (!room.marketplace) room.marketplace = [];
    room.marketplace.push({
      player,
      sellerId: sellerTeam.id,
      sellerName: sellerTeam.name,
      price
    });

    // Remove from seller's roster
    sellerTeam.roster = sellerTeam.roster.filter(p => p.id !== playerId);
    sellerTeam.budget += price;

    io.to(roomId).emit('room_updated', room);
    io.to(roomId).emit('player_listed', {
      player: player.name,
      seller: sellerTeam.name,
      price
    });

    callback({ success: true });
  });

  // Buy player from marketplace
  socket.on('buy_from_marketplace', ({ roomId, playerId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback({ success: false, error: 'Oda bulunamadı' });
      return;
    }

    if (room.phase !== 'halftime') {
      callback({ success: false, error: 'Sadece devre arasında alım yapılabilir' });
      return;
    }

    const buyerTeam = room.teams.find(t => t.id === socket.id);
    if (!buyerTeam) {
      callback({ success: false, error: 'Takım bulunamadı' });
      return;
    }

    const listing = room.marketplace?.find(l => l.player.id === playerId);
    if (!listing) {
      callback({ success: false, error: 'Oyuncu marketplace\'te bulunamadı' });
      return;
    }

    if (listing.sellerId === socket.id) {
      callback({ success: false, error: 'Kendi oyuncunu alamazsın' });
      return;
    }

    if (buyerTeam.budget < listing.price) {
      callback({ success: false, error: 'Yeterli bütçen yok' });
      return;
    }

    if (buyerTeam.roster.length >= 14) {
      callback({ success: false, error: 'Kadro dolu' });
      return;
    }

    // Transfer player
    buyerTeam.roster.push(listing.player);
    buyerTeam.budget -= listing.price;

    // Remove from marketplace
    room.marketplace = room.marketplace?.filter(l => l.player.id !== playerId);

    io.to(roomId).emit('room_updated', room);
    io.to(roomId).emit('player_bought', {
      player: listing.player.name,
      buyer: buyerTeam.name,
      price: listing.price
    });

    callback({ success: true });
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

// Admin API endpoints
app.get('/admin/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    phase: room.phase,
    teams: room.teams.map(t => ({ id: t.id, name: t.name, budget: t.budget, roster: t.roster.length })),
    competition: room.competition,
    maxPlayers: room.maxPlayers
  }));
  res.json({ rooms: roomList });
});

app.get('/admin/room/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({ room });
});

app.post('/admin/room/:roomId/phase', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const { phase } = req.body;
  room.phase = phase;

  // Initialize phase-specific state
  if (phase === 'auction' && !room.auctionState) {
    room.auctionState = {
      currentBids: {},
      highestBidder: null,
      highestBid: 0,
      timeLeft: 14,
      timerStarted: Date.now(),
      skippedPlayers: []
    };
    startAuctionTimer(req.params.roomId, io);
  }

  io.to(req.params.roomId).emit('phase_changed', { phase });
  io.to(req.params.roomId).emit('room_updated', room);
  res.json({ success: true });
});

app.post('/admin/room/:roomId/budget', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const { teamId, amount } = req.body;
  const team = room.teams.find(t => t.id === teamId);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }

  team.budget += amount;
  io.to(req.params.roomId).emit('room_updated', room);
  res.json({ success: true });
});

app.post('/admin/room/:roomId/skip', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const { index } = req.body;
  room.currentPlayerIndex = index;
  io.to(req.params.roomId).emit('room_updated', room);
  res.json({ success: true });
});

app.post('/admin/room/:roomId/finish-auction', (req, res) => {
  const roomId = req.params.roomId;
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  finalizeAuction(roomId, io);
  res.json({ success: true });
});

app.post('/admin/room/:roomId/reset', (req, res) => {
  const roomId = req.params.roomId;
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  // Reset room to initial state
  room.phase = 'lobby';
  room.currentPlayerIndex = 0;
  room.auctionState = undefined;
  room.stealChoices = {};
  room.tradeOffers = [];
  room.tradeResponses = new Set();
  room.matchResult = undefined;

  room.teams.forEach(team => {
    team.budget = 100;
    team.roster = [];
    team.scouts = 3;
    team.buff = 0;
    team.ready = false;
    team.formation = undefined;
    team.tactic = undefined;
    team.lineup = undefined;
  });

  const timer = auctionTimers.get(roomId);
  if (timer) {
    clearInterval(timer);
    auctionTimers.delete(roomId);
  }

  io.to(roomId).emit('phase_changed', { phase: 'lobby' });
  io.to(roomId).emit('room_updated', room);
  res.json({ success: true });
});

app.post('/admin/room/:roomId/add-player', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const { teamId, playerId } = req.body;
  const team = room.teams.find(t => t.id === teamId);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }

  // Find player from auction pool
  const player = room.auctionPool.find(p => p.id === playerId);
  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }

  // Add player to roster if not already there
  if (!team.roster.find(p => p.id === playerId)) {
    team.roster.push(player);
  }

  io.to(req.params.roomId).emit('room_updated', room);
  res.json({ success: true });
});

app.post('/admin/room/:roomId/remove-player', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const { teamId, playerId } = req.body;
  const team = room.teams.find(t => t.id === teamId);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }

  team.roster = team.roster.filter(p => p.id !== playerId);
  io.to(req.params.roomId).emit('room_updated', room);
  res.json({ success: true });
});

app.post('/admin/room/:roomId/fill-roster', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const { teamId, count } = req.body;
  const team = room.teams.find(t => t.id === teamId);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }

  const playersToAdd = count || (14 - team.roster.length);
  const availablePlayers = room.auctionPool.filter(p => !team.roster.find(r => r.id === p.id));

  for (let i = 0; i < playersToAdd && i < availablePlayers.length; i++) {
    team.roster.push(availablePlayers[i]);
  }

  io.to(req.params.roomId).emit('room_updated', room);
  res.json({ success: true, added: Math.min(playersToAdd, availablePlayers.length) });
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
