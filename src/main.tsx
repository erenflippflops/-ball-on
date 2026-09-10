import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import './style-joker.css';
import { socketService } from './socketService';
import type { Player, Team, Room, Phase } from './types';
import { translations, type Language } from './translations';
import { HalftimeComponent } from './HalftimeComponent';
import { TACTICS, isPlayerSuitableForTactic } from './tacticsSystem';
import { MiniField } from './MiniField';

function App() {
  const [phase, setPhase] = useState<Phase>('lobby');
  const [room, setRoom] = useState('');
  const [roomId, setRoomId] = useState('');
  const [nick, setNick] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [current, setCurrent] = useState<Player | null>(null);
  const [bid, setBid] = useState(1);
  const [message, setMessage] = useState('');
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [formation, setFormation] = useState('4-3-3');
  const [tactic, setTactic] = useState('Balanced');
  const [matchResult, setMatchResult] = useState<any>(null);
  const [tradeOffers, setTradeOffers] = useState<Array<{ from: string; to: string; give: Player; want: Player }>>([]);
  const [marketTrend, setMarketTrend] = useState<'boom' | 'crash' | 'stable'>('stable');
  const [gossipStars, setGossipStars] = useState<string[]>([]);
  const [playerCount, setPlayerCount] = useState(1);
  const [auctionTimer, setAuctionTimer] = useState(14);
  const [highestBid, setHighestBid] = useState(0);
  const [highestBidder, setHighestBidder] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [competition, setCompetition] = useState('Premier League');
  const [language, setLanguage] = useState<Language>('tr');
  const [auctionResult, setAuctionResult] = useState<{ player: Player; winner: string; amount: number; allBidders: any[]; free?: boolean } | null>(null);

  // Steal phase state
  const [stealTarget, setStealTarget] = useState('');
  const [stealOffer, setStealOffer] = useState('');
  const [stealProtect, setStealProtect] = useState('');

  // Halftime transfer window state
  const [halftimeTimer, setHalftimeTimer] = useState(90);
  const [halftimeOffers, setHalftimeOffers] = useState<Array<{ id: number; from: string; fromTeam: string; give: Player; want: Player }>>([]);

  // Admin mode state
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Pre-auction tactic selection
  const [chosenTactic, setChosenTactic] = useState<string>('');
  const [chosenFormation, setChosenFormation] = useState<string>('4-3-3');

  // Auction phase timer (6 minutes = 360 seconds)
  const [auctionPhaseTimeLeft, setAuctionPhaseTimeLeft] = useState<number>(360);

  const t = translations[language];
  const me = teams.find(t => t.id === socketService.getSocketId()) || { id: '', name: '', budget: 100, roster: [], ready: false, scouts: 3, buff: 0 };
  const opponent = teams.find(t => t.id !== socketService.getSocketId()) || { id: '', name: '', budget: 100, roster: [], ready: false, scouts: 3, buff: 0 };
  const avg = me.roster.length ? Math.round(me.roster.reduce((s, p) => s + p.baseOverall, 0) / me.roster.length) : 0;

  // Show center notification
  const showNotification = (text: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const socket = socketService.connect();

    socketService.onRoomUpdated((room: Room) => {
      setTeams(room.teams);
      setPhase(room.phase);
      setPlayerCount(room.teams.length);
      setMaxPlayers(room.maxPlayers || 2);
      if (room.matchResult) {
        setMatchResult(room.matchResult);
      }
      if (room.tradeOffers) {
        setTradeOffers(room.tradeOffers);
      }
    });

    socketService.onPhaseChanged((data) => {
      setPhase(data.phase as Phase);
      if (data.currentPlayer) {
        setCurrent(data.currentPlayer);
        setAuctionTimer(14);
        setHighestBid(0);
        setHighestBidder('');
        setBid(1);
      }
      // Start auction phase timer (6 minutes)
      if (data.phase === 'first_half_auction' || data.phase === 'second_half_auction') {
        setAuctionPhaseTimeLeft(360);
      }
    });

    socketService.onNextPlayer((data) => {
      setCurrent(data.player);
      setAuctionTimer(14);
      setHighestBid(0);
      setHighestBidder('');
      setBid(1);
    });

    socketService.onPlayerAcquired((data: any) => {
      // Store auction result to show modal
      setAuctionResult({
        player: data.player,
        winner: data.winner,
        amount: data.amount,
        allBidders: data.allBidders || [],
        free: data.free
      });

      if (data.free) {
        const msg = language === 'tr'
          ? `🎲 ${data.player.name} hiç teklif almadı! Rastgele ${data.winner} takımına ücretsiz gitti.`
          : `🎲 ${data.player.name} received no bids! Randomly assigned to ${data.winner} for free.`;
        setMessage(msg);
      } else {
        let bidInfo = '';
        if (data.allBidders && data.allBidders.length > 0) {
          const bidders = data.allBidders.map((b: any) => `${b.teamName}: ${b.amount} CR`).join(', ');
          bidInfo = language === 'tr' ? `📊 Teklifler: ${bidders}\n` : `📊 Bids: ${bidders}\n`;
        }
        const msg = language === 'tr'
          ? `🏆 ${data.winner} kazandı! ${data.player.name} ${data.amount} CR'ye alındı!`
          : `🏆 ${data.winner} won! ${data.player.name} bought for ${data.amount} CR!`;
        setMessage(`${bidInfo}${msg}`);
      }
    });

    socketService.onMatchResult((result) => {
      setMatchResult(result);
    });

    socketService.on('market_gossip', (data) => {
      setMessage(data.message);
      setGossipStars(data.stars || []);
    });

    socketService.on('market_shift', (data) => {
      setMarketTrend(data.trend);
      setMessage(data.message);
      showNotification(data.message, 'warning');
    });

    socketService.on('player_joined', (data) => {
      const msg = `🎮 ${data.teamName} odaya katıldı!`;
      setMessage(msg);
      showNotification(msg, 'success');
    });

    socketService.on('auction_timer', (data) => {
      setAuctionTimer(data.timeLeft);
    });

    socketService.on('bid_placed', (data) => {
      setHighestBid(data.highestBid);
      setHighestBidder(data.highestBidder);
      setBid(data.highestBid + 1);
      const msg = `${data.teamName} ${data.amount} CR teklif verdi!`;
      setMessage(msg);
      showNotification(msg, 'info');
    });

    socketService.on('player_skipped_bid', (data) => {
      const msg = `${data.teamName} pas geçti.`;
      setMessage(msg);
    });

    socketService.on('player_skipped', (data) => {
      const msg = `${data.player.name} için teklif verilmedi, geçildi.`;
      setMessage(msg);
    });

    socketService.on('time_extended', (data) => {
      setMessage(data.message);
      setAuctionTimer(data.newTimeLeft);
      showNotification(data.message, 'warning');
    });

    return () => {
      socketService.off('room_updated');
      socketService.off('phase_changed');
      socketService.off('next_player');
      socketService.off('player_acquired');
      socketService.off('match_result');
      socketService.off('market_gossip');
      socketService.off('market_shift');
      socketService.off('player_joined');
      socketService.off('auction_timer');
      socketService.off('bid_placed');
      socketService.off('player_skipped');
      socketService.off('time_extended');
    };
  }, []);

  // Auction phase countdown timer
  useEffect(() => {
    if (phase !== 'first_half_auction' && phase !== 'second_half_auction') return;

    const interval = setInterval(() => {
      setAuctionPhaseTimeLeft((prev) => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  const start = async () => {
    const response = await socketService.createRoom(nick || 'Oyuncu', maxPlayers, competition);
    if (response.success && response.roomId && response.room) {
      setRoomId(response.roomId);
      setRoom(response.roomId);
      setTeams(response.room.teams);
      setMessage(`${response.room.competition} odası hazır! ${response.room.maxPlayers} kişilik.`);
    } else {
      setMessage(response.error || 'Oda oluşturulamadı');
      showNotification(response.error || 'Oda oluşturulamadı', 'error');
    }
  };

  const join = async () => {
    if (!room) return;
    const response = await socketService.joinRoom(room, nick || 'Oyuncu');
    if (response.success && response.room) {
      setRoomId(room);
      setTeams(response.room.teams);
      setMessage('Odaya katıldın!');
      showNotification('Odaya başarıyla katıldın!', 'success');
    } else {
      setMessage(response.error || 'Odaya katılınamadı');
      showNotification(response.error || 'Odaya katılınamadı', 'error');
    }
  };

  const begin = async () => {
    if (!roomId) return;
    const response = await socketService.startGame(roomId);
    if (response.success) {
      setMessage('Açık artırma başladı!');
      showNotification('Açık artırma başladı!', 'success');
    } else {
      setMessage(response.error || 'Oyun başlatılamadı');
      showNotification(response.error || 'Oyun başlatılamadı', 'error');
    }
  };

  const buy = async (amount: number) => {
    if (!current || !roomId) return;
    if (amount > me.budget - (14 - me.roster.length)) {
      const msg = 'Bu teklif kadro rezervini ihlal ediyor.';
      setMessage(msg);
      showNotification(msg, 'error');
      return;
    }

    const response = await socketService.placeBid(roomId, amount);
    if (!response.success) {
      setMessage(response.error || 'Teklif başarısız');
      showNotification(response.error || 'Teklif başarısız', 'error');
    }
  };

  const skip = async () => {
    if (!roomId) return;
    const response = await socketService.skipPlayer(roomId);
    if (response.success) {
      setMessage('Pas geçtin. Bu açık artırmaya tekrar dönemezsin.');
    }
  };

  const scout = async () => {
    if (me.scouts <= 0) {
      setMessage('Scout hakkın kalmadı.');
      showNotification('Scout hakkın kalmadı.', 'error');
      return;
    }
    if (!roomId) return;

    const response = await socketService.useScout(roomId);
    if (response.success) {
      const { tier, playerName, position, overall } = response;
      const msg = `🔎 Scout: ${playerName} (${position}) - ${overall} OVR - ${tier?.toUpperCase()}`;
      setMessage(msg);
      showNotification(msg, 'info');
    } else {
      setMessage(response.error || 'Scout kullanılamadı');
      showNotification(response.error || 'Scout kullanılamadı', 'error');
    }
  };

  const actionPhase = (p: Phase, msg: string) => {
    setPhase(p);
    setMessage(msg);
  };

  const submitSteal = async () => {
    if (!roomId) return;
    if (!stealTarget || !stealOffer || !stealProtect) {
      setMessage('Lütfen tüm seçimleri yapın!');
      showNotification('Lütfen tüm seçimleri yapın!', 'error');
      return;
    }
    const response = await socketService.submitSteal(roomId, stealTarget, stealOffer, stealProtect);
    if (response.success) {
      setMessage('Seçiminiz kaydedildi, sonuçlar işleniyor...');
      showNotification('Seçiminiz kaydedildi!', 'success');
    } else {
      setMessage(response.error || 'Seçim başarısız');
      showNotification(response.error || 'Seçim başarısız', 'error');
    }
  };

  const acceptTrade = async (accept: boolean) => {
    if (!roomId) return;
    console.log('Accept trade called:', { accept, roomId });
    const response = await socketService.tradeResponse(roomId, accept);
    console.log('Trade response:', response);
    if (response.success) {
      showNotification(accept ? 'Takas kabul edildi!' : 'Takas reddedildi', 'success');
    } else {
      showNotification(response.error || 'Takas işlemi başarısız', 'error');
    }
  };

  const saveLineup = async () => {
    if (!roomId) return;
    await socketService.saveLineup(roomId, formation, {});
  };

  const saveTactics = async () => {
    if (!roomId) return;
    await socketService.saveTactics(roomId, tactic);
  };

  const sim = async () => {
    if (!roomId) return;
    setMessage('Maç simülasyonu başlıyor...');
    await socketService.simulateMatch(roomId);
  };

  // Halftime handlers
  const handleSellPlayer = async (playerId: string, price: number) => {
    if (!roomId) return;
    // TODO: Implement sell player socket event
    showNotification(t.playerSold, 'success');
  };

  const handleMakeOffer = async (targetTeamId: string, givePlayerId: string, wantPlayerId: string) => {
    if (!roomId) return;
    // TODO: Implement halftime offer socket event
    showNotification(t.offerSent, 'success');
  };

  const handleRespondOffer = async (offerId: number, accept: boolean) => {
    if (!roomId) return;
    // TODO: Implement halftime respond socket event
    if (accept) {
      showNotification(t.offerAccepted, 'success');
    }
  };

  const handleFinishHalftime = async () => {
    if (!roomId) return;
    const result = await socketService.finishHalftime(roomId);
    if (result.success) {
      showNotification(language === 'tr' ? 'İkinci yarı açık artırmaya geçiliyor...' : 'Proceeding to second half auction...', 'info');
    } else {
      showNotification(result.error || 'Failed to finish halftime', 'error');
    }
  };

  // Admin functions
  const handleAdminLogin = () => {
    if (adminUsername === 'amo06' && adminPassword === 'tugba06') {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setAdminUsername('');
      setAdminPassword('');
      showNotification('Admin mode activated! 🔧', 'success');
    } else {
      showNotification('Invalid credentials', 'error');
      setAdminPassword('');
    }
  };

  const adminChangePhase = async (newPhase: Phase) => {
    if (!isAdmin) {
      showNotification('Admin authentication required', 'error');
      return;
    }
    if (!roomId) {
      showNotification('No active room. Create or join a room first.', 'error');
      console.log('Admin change phase failed - no roomId:', { isAdmin, roomId, room });
      return;
    }
    const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    console.log('Changing phase to:', newPhase, 'for room:', roomId);
    try {
      const response = await fetch(`${API_URL}/admin/room/${roomId}/phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: newPhase })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Phase change response:', data);
      if (data.success) {
        showNotification(`Phase changed to ${newPhase}`, 'success');
      } else {
        showNotification(`Failed: ${data.error}`, 'error');
      }
    } catch (err) {
      console.error('Failed to change phase:', err);
      showNotification(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const adminAddBudget = async (teamId: string, amount: number) => {
    if (!isAdmin) {
      showNotification('Admin authentication required', 'error');
      return;
    }
    if (!roomId) {
      showNotification('No active room. Create or join a room first.', 'error');
      return;
    }
    const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    console.log('Adding budget:', amount, 'to team:', teamId, 'in room:', roomId);
    try {
      const response = await fetch(`${API_URL}/admin/room/${roomId}/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, amount })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Budget change response:', data);
      if (data.success) {
        showNotification(`Budget ${amount > 0 ? 'added' : 'removed'}`, 'success');
      } else {
        showNotification(`Failed: ${data.error}`, 'error');
      }
    } catch (err) {
      console.error('Failed to change budget:', err);
      showNotification(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const adminFillRoster = async (teamId: string) => {
    if (!isAdmin) {
      showNotification('Admin authentication required', 'error');
      return;
    }
    if (!roomId) {
      showNotification('No active room. Create or join a room first.', 'error');
      return;
    }
    const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    console.log('Filling roster for team:', teamId, 'in room:', roomId);
    try {
      const response = await fetch(`${API_URL}/admin/room/${roomId}/fill-roster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Fill roster response:', data);
      if (data.success) {
        showNotification('Roster filled', 'success');
      } else {
        showNotification(`Failed: ${data.error}`, 'error');
      }
    } catch (err) {
      console.error('Failed to fill roster:', err);
      showNotification(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const adminRemovePlayer = async (teamId: string, playerId: string) => {
    if (!isAdmin) {
      showNotification('Admin authentication required', 'error');
      return;
    }
    if (!roomId) {
      showNotification('No active room. Create or join a room first.', 'error');
      return;
    }
    const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    console.log('Removing player:', playerId, 'from team:', teamId, 'in room:', roomId);
    try {
      const response = await fetch(`${API_URL}/admin/room/${roomId}/remove-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, playerId })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Remove player response:', data);
      if (data.success) {
        showNotification('Player removed', 'success');
      } else {
        showNotification(`Failed: ${data.error}`, 'error');
      }
    } catch (err) {
      console.error('Failed to remove player:', err);
      showNotification(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  return (
    <div className="app">
      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div className="auction-result-modal" onClick={() => setShowAdminLogin(false)}>
          <div className="auction-result-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="auction-result-header">
              <p className="kicker">ADMIN LOGIN</p>
              <h2>🔧 Admin Access</h2>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Username</label>
              <input
                type="text"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(10, 26, 28, 0.6)',
                  border: '1px solid rgba(132, 204, 22, 0.3)',
                  borderRadius: '8px',
                  color: '#F1F5F9',
                  fontSize: '14px'
                }}
                placeholder="Enter username"
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(10, 26, 28, 0.6)',
                  border: '1px solid rgba(132, 204, 22, 0.3)',
                  borderRadius: '8px',
                  color: '#F1F5F9',
                  fontSize: '14px'
                }}
                placeholder="Enter password"
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="primary" onClick={handleAdminLogin} style={{ flex: 1 }}>
                Login
              </button>
              <button className="ghost" onClick={() => setShowAdminLogin(false)} style={{ flex: 1 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel Overlay */}
      {isAdmin && showAdminPanel && phase !== 'lobby' && (
        <div style={{
          position: 'fixed',
          top: '76px',
          right: '20px',
          width: '350px',
          maxHeight: 'calc(100vh - 100px)',
          overflowY: 'auto',
          background: 'rgba(2, 6, 23, 0.98)',
          border: '2px solid #84cc16',
          borderRadius: '12px',
          padding: '20px',
          zIndex: 9999,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9)'
        }}>
          <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid rgba(132, 204, 22, 0.2)' }}>
            <h3 style={{ margin: '0 0 5px', color: '#84cc16', fontSize: '1.2rem', fontFamily: 'var(--font-heading)' }}>
              🔧 ADMIN PANEL
            </h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
              Room: {roomId || '❌ NO ROOM'}<br/>
              Phase: {phase}<br/>
              Socket: {socketService.getSocketId() ? '✅' : '❌'}
            </p>
          </div>

          {/* Phase Control */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#F1F5F9' }}>⚡ Phase Control</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {(['auction', 'steal', 'trade', 'lineup', 'tactics', 'match', 'halftime', 'second_half', 'result'] as Phase[]).map(p => (
                <button
                  key={p}
                  onClick={() => adminChangePhase(p)}
                  disabled={phase === p}
                  style={{
                    padding: '8px',
                    background: phase === p ? '#84cc16' : 'rgba(132, 204, 22, 0.1)',
                    border: '1px solid rgba(132, 204, 22, 0.3)',
                    borderRadius: '6px',
                    color: phase === p ? '#0F172A' : '#F1F5F9',
                    cursor: phase === p ? 'not-allowed' : 'pointer',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    textTransform: 'uppercase'
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Teams Control */}
          <div>
            <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#F1F5F9' }}>👥 Teams</h4>
            {teams.map(team => (
              <div key={team.id} style={{ marginBottom: '15px', padding: '12px', background: 'rgba(15, 23, 42, 0.8)', borderRadius: '8px', border: '1px solid rgba(132, 204, 22, 0.2)' }}>
                <div style={{ fontWeight: 700, marginBottom: '8px', color: '#84cc16', fontSize: '0.9rem' }}>{team.name}</div>
                <div style={{ fontSize: '0.75rem', marginBottom: '10px', color: '#94a3b8' }}>
                  Budget: <strong>{team.budget} CR</strong> | Roster: <strong>{team.roster.length}/14</strong>
                </div>
                <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                  <button
                    onClick={() => adminAddBudget(team.id, 20)}
                    style={{ flex: 1, padding: '6px', background: 'rgba(132, 204, 22, 0.2)', border: '1px solid rgba(132, 204, 22, 0.4)', borderRadius: '4px', color: '#84cc16', cursor: 'pointer', fontSize: '0.7rem' }}
                  >
                    +20 CR
                  </button>
                  <button
                    onClick={() => adminAddBudget(team.id, -20)}
                    style={{ flex: 1, padding: '6px', background: 'rgba(220, 38, 38, 0.2)', border: '1px solid rgba(220, 38, 38, 0.4)', borderRadius: '4px', color: '#DC2626', cursor: 'pointer', fontSize: '0.7rem' }}
                  >
                    -20 CR
                  </button>
                </div>
                <button
                  onClick={() => adminFillRoster(team.id)}
                  disabled={team.roster.length >= 14}
                  style={{ width: '100%', padding: '8px', background: team.roster.length >= 14 ? 'rgba(100, 100, 100, 0.2)' : 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '4px', color: team.roster.length >= 14 ? '#666' : '#3b82f6', cursor: team.roster.length >= 14 ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: 600, marginBottom: '8px' }}
                >
                  Fill Roster ({14 - team.roster.length} more)
                </button>
                {team.roster.length > 0 && (
                  <details>
                    <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: '#94a3b8' }}>Players ({team.roster.length})</summary>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', marginTop: '8px' }}>
                      {team.roster.map(player => (
                        <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', background: 'rgba(7, 23, 19, 0.6)', borderRadius: '4px', marginBottom: '4px', fontSize: '0.7rem' }}>
                          <span>{player.name} ({player.primaryPosition} - {player.baseOverall})</span>
                          <button
                            onClick={() => adminRemovePlayer(team.id, player.id)}
                            style={{ padding: '2px 6px', background: 'rgba(220, 38, 38, 0.3)', border: 'none', borderRadius: '3px', color: '#DC2626', cursor: 'pointer', fontSize: '0.65rem' }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auction Result Modal */}
      {auctionResult && (
        <AuctionResultModal
          result={auctionResult}
          language={language}
          onClose={() => setAuctionResult(null)}
        />
      )}

      {/* Center Notification System */}
      {notification && (
        <div className="notification-center">
          <div className={`notification ${notification.type}`}>
            {notification.text}
          </div>
        </div>
      )}

      <header>
        <div className="brand" onClick={() => {
          if (phase !== 'lobby' && window.confirm(language === 'tr' ? 'Ana ekrana dönmek istediğinize emin misiniz? Oyun devam edecek.' : 'Are you sure you want to return to lobby? Game will continue.')) {
            window.location.reload();
          } else if (phase === 'lobby') {
            window.location.reload();
          }
        }} style={{ cursor: 'pointer' }}>
          <span className="ball">⚽</span>
          <div>
            <strong>BALL ON!</strong>
            <small>Draft Eleven Manager</small>
          </div>
        </div>
        <div className="phase">
          {(phase === 'first_half_auction' || phase === 'second_half_auction') ? (
            <>
              <span>{phase === 'first_half_auction' ? 'İLK YARI AÇIK ARTIRMA' : 'İKİNCİ YARI AÇIK ARTIRMA'}</span>
              <b style={{ color: auctionPhaseTimeLeft < 60 ? '#f59e0b' : '#84cc16', fontSize: '1.2rem' }}>
                {Math.floor(auctionPhaseTimeLeft / 60)}:{String(auctionPhaseTimeLeft % 60).padStart(2, '0')}
              </b>
            </>
          ) : (
            <>
              <span>{t.phase}</span>
              <b>{phase.toUpperCase()}</b>
            </>
          )}
        </div>
        <div className="language-toggle">
          <button
            className={language === 'tr' ? 'active' : ''}
            onClick={() => setLanguage('tr')}
          >
            TR
          </button>
          <button
            className={language === 'en' ? 'active' : ''}
            onClick={() => setLanguage('en')}
          >
            EN
          </button>
        </div>
        {!isAdmin ? (
          <button
            onClick={() => setShowAdminLogin(true)}
            style={{
              padding: '8px 12px',
              background: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: '6px',
              color: '#DC2626',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 700
            }}
          >
            🔧 ADMIN
          </button>
        ) : (
          <button
            onClick={() => setShowAdminPanel(!showAdminPanel)}
            style={{
              padding: '8px 12px',
              background: 'rgba(132, 204, 22, 0.2)',
              border: '1px solid rgba(132, 204, 22, 0.5)',
              borderRadius: '6px',
              color: '#84cc16',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 700
            }}
          >
            🔧 {showAdminPanel ? 'HIDE' : 'SHOW'}
          </button>
        )}
        <div className="room">{room && <>{t.room} <b>{room}</b></>}</div>
      </header>
      <main>
        {phase === 'lobby' ? (
          <Lobby
            nick={nick}
            setNick={setNick}
            room={room}
            setRoom={setRoom}
            start={start}
            join={join}
            begin={begin}
            message={message}
            playerCount={playerCount}
            maxPlayers={maxPlayers}
            setMaxPlayers={setMaxPlayers}
            competition={competition}
            setCompetition={setCompetition}
          />
        ) : phase === 'tactic_selection' ? (
          <TacticSelection
            onSelect={(tacticId, formation) => {
              setChosenTactic(tacticId);
              setChosenFormation(formation);
              socketService.selectTactic(roomId, tacticId, formation);
            }}
            selectedTactic={chosenTactic}
            selectedFormation={chosenFormation}
            setSelectedTactic={setChosenTactic}
            setSelectedFormation={setChosenFormation}
          />
        ) : (
          <Game
            phase={phase}
            me={me}
            opponent={opponent}
            teams={teams}
            avg={avg}
            current={current}
            bid={bid}
            setBid={setBid}
            buy={buy}
            skip={skip}
            scout={scout}
            formation={formation}
            setFormation={setFormation}
            tactic={tactic}
            setTactic={setTactic}
            actionPhase={actionPhase}
            sim={sim}
            message={message}
            submitSteal={submitSteal}
            acceptTrade={acceptTrade}
            saveLineup={saveLineup}
            saveTactics={saveTactics}
            matchResult={matchResult}
            stealTarget={stealTarget}
            setStealTarget={setStealTarget}
            stealOffer={stealOffer}
            setStealOffer={setStealOffer}
            stealProtect={stealProtect}
            setStealProtect={setStealProtect}
            tradeOffers={tradeOffers}
            marketTrend={marketTrend}
            gossipStars={gossipStars}
            auctionTimer={auctionTimer}
            highestBid={highestBid}
            highestBidder={highestBidder}
            language={language}
            halftimeTimer={halftimeTimer}
            halftimeOffers={halftimeOffers}
            onSellPlayer={handleSellPlayer}
            onMakeOffer={handleMakeOffer}
            onRespondOffer={handleRespondOffer}
            onFinishHalftime={handleFinishHalftime}
            chosenTactic={chosenTactic}
            chosenFormation={chosenFormation}
          />
        )}
      </main>
    </div>
  );
}

// Circular Timer Component
function CircularTimer({ timeLeft, total = 30 }: { timeLeft: number; total?: number }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const progress = (timeLeft / total) * circumference;

  const getTimerClass = () => {
    if (timeLeft <= 5) return 'critical';
    if (timeLeft <= 10) return 'warning';
    return '';
  };

  return (
    <div className="timer-container">
      <svg width="100" height="100" className="timer-circle">
        <circle
          className="timer-bg"
          cx="50"
          cy="50"
          r={radius}
        />
        <circle
          className={`timer-progress ${getTimerClass()}`}
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
        />
      </svg>
      <div className={`timer-text ${getTimerClass()}`}>
        {timeLeft}
      </div>
    </div>
  );
}

// Tactic Selection Screen (Pre-Auction)
function TacticSelection(p: {
  onSelect: (tacticId: string, formation: string) => void;
  selectedTactic: string;
  selectedFormation: string;
  setSelectedTactic: (id: string) => void;
  setSelectedFormation: (f: string) => void;
}) {
  const selectedTacticData = TACTICS.find(t => t.id === p.selectedTactic);
  const recommendedFormations = selectedTacticData?.formations || ['4-3-3', '4-4-2', '3-5-2'];

  return (
    <div className="panel" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <p className="kicker">BALL ON! · STRATEJİ</p>
      <h1>Taktik ve Diziliş Seç</h1>
      <p style={{ marginBottom: '30px' }}>
        Oyun başlamadan önce taktiğini ve dizilişini seç. Bu seçim tüm oyun boyunca <strong>sabit kalacak</strong>.
        Taktiğine uygun oyuncular açık artırmada ⭐ yıldızlı görünecek.
      </p>

      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', color: '#84cc16' }}>Taktiğini Seç:</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
          {TACTICS.map(tactic => (
            <button
              key={tactic.id}
              onClick={() => p.setSelectedTactic(tactic.id)}
              style={{
                padding: '20px',
                background: p.selectedTactic === tactic.id ? 'rgba(132, 204, 22, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                border: p.selectedTactic === tactic.id ? '2px solid #84cc16' : '1px solid rgba(132, 204, 22, 0.3)',
                borderRadius: '12px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{tactic.icon}</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '5px', color: '#F1F5F9' }}>
                {tactic.name}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.4' }}>
                {tactic.description}
              </div>
              {p.selectedTactic === tactic.id && (
                <div style={{ marginTop: '10px', fontSize: '0.75rem', color: '#84cc16' }}>
                  ✓ Seçildi
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {p.selectedTactic && (
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', color: '#84cc16' }}>
            Diziliş Seç {selectedTacticData && `(${selectedTacticData.name} için önerilen)`}:
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
            {['4-3-3', '4-4-2', '3-5-2', '4-2-3-1', '3-4-3'].map(formation => {
              const isRecommended = recommendedFormations.includes(formation);
              return (
                <button
                  key={formation}
                  onClick={() => p.setSelectedFormation(formation)}
                  style={{
                    padding: '15px 10px',
                    background: p.selectedFormation === formation ? '#84cc16' : isRecommended ? 'rgba(132, 204, 22, 0.15)' : 'rgba(15, 23, 42, 0.8)',
                    border: p.selectedFormation === formation ? '2px solid #84cc16' : isRecommended ? '1px solid rgba(132, 204, 22, 0.5)' : '1px solid rgba(132, 204, 22, 0.3)',
                    borderRadius: '8px',
                    color: p.selectedFormation === formation ? '#0F172A' : '#F1F5F9',
                    cursor: 'pointer',
                    fontWeight: p.selectedFormation === formation ? 700 : 500,
                    fontSize: '0.9rem',
                    position: 'relative'
                  }}
                >
                  {formation}
                  {isRecommended && p.selectedFormation !== formation && (
                    <div style={{ fontSize: '0.65rem', color: '#84cc16', marginTop: '3px' }}>
                      ⭐ Önerilen
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        className="primary"
        onClick={() => p.onSelect(p.selectedTactic, p.selectedFormation)}
        disabled={!p.selectedTactic}
        style={{
          opacity: !p.selectedTactic ? 0.5 : 1,
          cursor: !p.selectedTactic ? 'not-allowed' : 'pointer'
        }}
      >
        Taktiği onayla ve açık artırmaya başla →
      </button>

      {p.selectedTactic && selectedTacticData && (
        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: 'rgba(132, 204, 22, 0.1)',
          border: '1px solid rgba(132, 204, 22, 0.3)',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '10px' }}>
            <strong style={{ color: '#84cc16' }}>{selectedTacticData.name}</strong> taktiğine uygun arketipler:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {selectedTacticData.preferredArchetypes.slice(0, 8).map(archetype => (
              <span
                key={archetype}
                style={{
                  padding: '4px 10px',
                  background: 'rgba(132, 204, 22, 0.15)',
                  border: '1px solid rgba(132, 204, 22, 0.3)',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  color: '#84cc16'
                }}
              >
                {archetype}
              </span>
            ))}
            {selectedTacticData.preferredArchetypes.length > 8 && (
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '4px 10px' }}>
                +{selectedTacticData.preferredArchetypes.length - 8} daha...
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Lobby(p: any) {
  return (
    <section className="lobby">
      <div className="hero">
        <p className="kicker">GERÇEK ZAMANLI KADRO KURMA</p>
        <h1>
          Takımını kur.
          <br />
          <em>Oyunu değiştir.</em>
        </h1>
        <p className="intro">Gizli oyuncu havuzundan teklif ver, rakipten oyuncu çal, doğru kimyayla turnuvayı kazan.</p>

        {/* Game Explanation */}
        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '12px',
          border: '1px solid rgba(132, 204, 22, 0.2)',
          backdropFilter: 'blur(10px)'
        }}>
          <h3 style={{ margin: '0 0 15px', fontSize: '1.1rem', color: '#84cc16', fontFamily: 'var(--font-heading)' }}>
            🎯 NASIL OYNANIR?
          </h3>
          <div style={{ fontSize: '0.9rem', lineHeight: '1.8', color: '#E2E8F0' }}>
            <p style={{ margin: '0 0 10px' }}>
              <strong style={{ color: '#84cc16' }}>1. Açık Artırma:</strong> 14 oyuncuyu sırayla sat satın al. Piyasa değerine dikkat et, bütçeni iyi kullan!
            </p>
            <p style={{ margin: '0 0 10px' }}>
              <strong style={{ color: '#84cc16' }}>2. Oyuncu Çalma:</strong> Rakipten bir oyuncu çal, biri seni korusun. İstediğin oyuncuyu seç!
            </p>
            <p style={{ margin: '0 0 10px' }}>
              <strong style={{ color: '#84cc16' }}>3. Takas:</strong> Rakiple oyuncu takası teklif et veya kabul et.
            </p>
            <p style={{ margin: '0' }}>
              <strong style={{ color: '#84cc16' }}>4. Maç:</strong> İlk 11'ini seç, taktiğini belirle ve rakibinle kapış!
            </p>
          </div>
        </div>
      </div>
      <div className="card lobby-card">
        <h2>Oyuna katıl</h2>
        <label>
          Takma ad
          <input value={p.nick} onChange={e => p.setNick(e.target.value)} placeholder="Örn. Kartal11" />
        </label>
        <label>
          Turnuva / Lig
          <select value={p.competition} onChange={e => p.setCompetition(e.target.value)}>
            <optgroup label="Ligler">
              <option value="Premier League">🏴 Premier League</option>
              <option value="La Liga">🇪🇸 La Liga</option>
              <option value="Serie A">🇮🇹 Serie A</option>
              <option value="Bundesliga">🇩🇪 Bundesliga</option>
              <option value="Ligue 1">🇫🇷 Ligue 1</option>
            </optgroup>
            <optgroup label="Turnuvalar">
              <option value="Champions League">🏆 Champions League</option>
              <option value="Europa League">🥈 Europa League</option>
              <option value="FA Cup">🏴 FA Cup</option>
              <option value="Copa del Rey">🇪🇸 Copa del Rey</option>
              <option value="Coppa Italia">🇮🇹 Coppa Italia</option>
            </optgroup>
          </select>
        </label>
        <label>
          Maksimum oyuncu sayısı
          <select value={p.maxPlayers} onChange={e => p.setMaxPlayers(Number(e.target.value))}>
            <option value={2}>2 Kişi (1v1)</option>
            <option value={4}>4 Kişi</option>
            <option value={6}>6 Kişi</option>
            <option value={8}>8 Kişi</option>
          </select>
        </label>
        <button className="primary" onClick={p.start}>
          + Yeni oda oluştur
        </button>
        <div className="or">veya</div>
        <div className="join">
          <input
            value={p.room}
            onChange={e => p.setRoom(e.target.value.toUpperCase())}
            placeholder="ODA KODU"
          />
          <button onClick={p.join}>Katıl</button>
        </div>
        {p.room && (
          <div className="lobby-ready">
            <span className="dot" /> {p.room} odası · {p.playerCount || 1}/{p.maxPlayers} Oyuncu
            {p.playerCount >= p.maxPlayers && <span style={{ color: '#b8ed61', marginLeft: '10px' }}>✓ Hazır</span>}
            <button className="primary" onClick={p.begin}>
              Oyunu başlat →
            </button>
          </div>
        )}
        <p className="hint">Server authoritative · Seed tabanlı simülasyon · Türkçe</p>
      </div>
    </section>
  );
}

function Game(p: any) {
  const { me } = p;

  const getPositionCategory = (pos: string) => {
    if (pos === 'GK') return 'GK';
    if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'DEF';
    if (['DM', 'CM', 'AM', 'LM', 'RM'].includes(pos)) return 'MID';
    if (['LW', 'RW', 'ST'].includes(pos)) return 'ATT';
    return 'MID';
  };

  const positionStats = {
    GK: me.roster.filter((p: Player) => getPositionCategory(p.primaryPosition) === 'GK').length,
    DEF: me.roster.filter((p: Player) => getPositionCategory(p.primaryPosition) === 'DEF').length,
    MID: me.roster.filter((p: Player) => getPositionCategory(p.primaryPosition) === 'MID').length,
    ATT: me.roster.filter((p: Player) => getPositionCategory(p.primaryPosition) === 'ATT').length
  };

  const positionLimits = { GK: 2, DEF: 5, MID: 5, ATT: 4 };

  return (
    <section className="game">
      <aside className="sidebar">
        <div className="team-head">
          <div className="crest">{me.name[0]}</div>
          <div>
            <b>{me.name}</b>
            <small>Oyuncu 1</small>
          </div>
          <span className="online">●</span>
        </div>
        <div className="wallet">
          <span>BÜTÇE</span>
          <strong>
            {me.budget} <small>CR</small>
          </strong>
          <div className="bar">
            <i style={{ width: `${me.budget}%` }} />
          </div>
        </div>
        <div className="stat-grid">
          <div>
            <b>{me.roster.length}</b>
            <small>KADRO</small>
          </div>
          <div>
            <b>{p.avg || '—'}</b>
            <small>ORT. OVR</small>
          </div>
          <div>
            <b>{me.scouts}</b>
            <small>SCOUT</small>
          </div>
          <div>
            <b>+{me.buff}</b>
            <small>BUFF</small>
          </div>
        </div>
        <div style={{ margin: '15px 0', padding: '12px', background: 'rgba(10, 26, 21, 0.6)', borderRadius: '8px', border: '1px solid rgba(26, 51, 41, 0.5)' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '11px', color: '#9ab3a8', fontWeight: 600 }}>POZİSYON DAĞILIMI</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
            {Object.entries(positionStats).map(([pos, count]) => (
              <div key={pos} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'rgba(7, 23, 19, 0.8)', borderRadius: '4px' }}>
                <span style={{ color: '#b8ed61' }}>{pos}</span>
                <b style={{ color: count >= positionLimits[pos as keyof typeof positionLimits] ? '#ff6b6b' : '#fff' }}>
                  {count}/{positionLimits[pos as keyof typeof positionLimits]}
                </b>
              </div>
            ))}
          </div>
        </div>
        <h3>
          KADRO <span>{me.roster.length}/14</span>
        </h3>
        <MiniField roster={me.roster} formation={me.formation || p.chosenFormation || '4-3-3'} />
        <div style={{ marginTop: '12px', fontSize: '10px', color: '#729187', textAlign: 'center' }}>
          İlk 11 otomatik yerleştirildi
        </div>
      </aside>
      <div className="board">
        <div className="notice">{p.message}</div>
        {(p.phase === 'first_half_auction' || p.phase === 'second_half_auction') && <Auction {...p} />}
        {p.phase === 'steal' && <Steal {...p} />}
        {p.phase === 'trade' && <Trade {...p} />}
        {p.phase === 'match' && <Match />}
        {p.phase === 'halftime' && (
          <HalftimeComponent
            me={p.me}
            opponents={p.teams.filter((t: Team) => t.id !== p.me.id)}
            language={p.language}
            halftimeTimer={p.halftimeTimer}
            onSellPlayer={p.onSellPlayer}
            onMakeOffer={p.onMakeOffer}
            onRespondOffer={p.onRespondOffer}
            onFinish={p.onFinishHalftime}
            incomingOffers={p.halftimeOffers}
          />
        )}
        {p.phase === 'result' && <Result result={p.matchResult} />}
      </div>
      <aside className="rightbar">
        <h3>PİYASA DURUMU</h3>
        <div style={{ padding: '12px', background: 'rgba(17, 44, 36, 0.6)', borderRadius: '5px', marginBottom: '15px', border: '1px solid rgba(184, 237, 97, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            {p.marketTrend === 'boom' && <span style={{ fontSize: '20px' }}>📈</span>}
            {p.marketTrend === 'crash' && <span style={{ fontSize: '20px' }}>📉</span>}
            {p.marketTrend === 'stable' && <span style={{ fontSize: '20px' }}>💼</span>}
            <b style={{ fontSize: '11px', color: p.marketTrend === 'boom' ? '#b8ed61' : p.marketTrend === 'crash' ? '#ff7b6e' : '#9ab3a8' }}>
              {p.marketTrend === 'boom' ? 'CANLI' : p.marketTrend === 'crash' ? 'DURGUN' : 'NORMAL'}
            </b>
          </div>
          <span style={{ fontSize: '10px', color: '#729187', display: 'block' }}>
            {p.marketTrend === 'boom' && 'Oyuncu değerleri yükselişte'}
            {p.marketTrend === 'crash' && 'Fırsatlar çıkabilir'}
            {p.marketTrend === 'stable' && 'Piyasa dengeli'}
          </span>
        </div>

        {p.gossipStars && p.gossipStars.length > 0 && (
          <>
            <h3>TRANSFER DEDİKODULARI</h3>
            <div style={{ padding: '10px', background: 'rgba(17, 44, 36, 0.6)', borderRadius: '5px', marginBottom: '15px', border: '1px solid rgba(184, 237, 97, 0.1)' }}>
              <span style={{ fontSize: '10px', color: '#729187', display: 'block', marginBottom: '8px' }}>
                📰 Havuzda görülebilecek yıldızlar:
              </span>
              {p.gossipStars.map((name: string, idx: number) => (
                <div key={idx} style={{ fontSize: '9px', color: '#b8ed61', padding: '3px 0' }}>
                  • {name}
                </div>
              ))}
            </div>
          </>
        )}

        <h3>TURNUVA</h3>
        <div className="bracket">
          <div>
            <span>Yarı final</span>
            <b>Sen</b>
            <i>vs</i>
            <b>Bot Atlas</b>
          </div>
          <div className="final">
            <span>Final</span>
            <b>?</b>
          </div>
        </div>
        <h3>GİZLİ HEDEFLER</h3>
        <div className="objective">
          <b>💰 Tutumlu Menajer</b>
          <span>Kadroyu en az 10 CR ile tamamla</span>
          <progress value={me.roster.length >= 14 ? me.budget : 0} max="10" />
          <small style={{ fontSize: '10px', color: '#9ab3a8', marginTop: '4px', display: 'block' }}>
            {me.roster.length >= 14 ? `${me.budget}/10 CR kaldı` : 'Önce kadroyu tamamla'}
          </small>
        </div>
        <div className="objective">
          <b>🎨 Arketip Koleksiyoncusu</b>
          <span>5 farklı arketip topla</span>
          <progress
            value={new Set(me.roster.map((x: Player) => x.archetype)).size}
            max="5"
          />
          <small style={{ fontSize: '10px', color: '#9ab3a8', marginTop: '4px', display: 'block' }}>
            {new Set(me.roster.map((x: Player) => x.archetype)).size}/5 arketip
          </small>
        </div>
        <div className="objective">
          <b>⭐ Yıldız Avcısı</b>
          <span>En az 2 STAR oyuncu topla</span>
          <progress
            value={me.roster.filter((x: Player) => x.marketTier === 'star').length}
            max="2"
          />
          <small style={{ fontSize: '10px', color: '#9ab3a8', marginTop: '4px', display: 'block' }}>
            {me.roster.filter((x: Player) => x.marketTier === 'star').length}/2 yıldız
          </small>
        </div>
        <div className="objective">
          <b>📊 Dengeli Kadro</b>
          <span>Her pozisyondan en az 1 oyuncu</span>
          <progress
            value={Object.values(positionStats).filter((count: number) => count > 0).length}
            max="4"
          />
          <small style={{ fontSize: '10px', color: '#9ab3a8', marginTop: '4px', display: 'block' }}>
            {Object.values(positionStats).filter((count: number) => count > 0).length}/4 pozisyon dolu
          </small>
        </div>
      </aside>
    </section>
  );
}

function Auction(p: any) {
  const x = p.current as Player;
  const t = translations[p.language as Language];
  const myTeam = p.teams.find((team: Team) => team.id === socketService.getSocketId());
  const isSuitableForTactic = myTeam?.chosenTactic ? isPlayerSuitableForTactic(x, myTeam.chosenTactic) : false;

  if (!x) {
    return (
      <div className="auction" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center', color: '#9ab3a8' }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⏳</div>
          <p>{p.language === 'tr' ? 'Oyuncu yükleniyor...' : 'Loading player...'}</p>
        </div>
      </div>
    );
  }

  const maxBid = Math.max(1, p.me.budget - (14 - p.me.roster.length));

  return (
    <div className="auction">
      <div className="auction-top">
        <span className="kicker">
          {p.phase === 'first_half_auction' ? 'İLK YARI AÇIK ARTIRMA' : 'İKİNCİ YARI AÇIK ARTIRMA'} · {p.me.roster.length + 1}. TUR
        </span>
        <CircularTimer timeLeft={p.auctionTimer} total={30} />
      </div>
      {p.highestBid > 0 && (
        <div style={{ padding: '12px', background: 'rgba(16, 45, 37, 0.6)', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', border: '1px solid rgba(184, 237, 97, 0.2)' }}>
          <small style={{ color: '#9ab3a8', fontSize: '11px', display: 'block' }}>EN YÜKSEK TEKLİF</small>
          <strong style={{ color: '#b8ed61', fontSize: '24px', fontFamily: 'var(--font-heading)' }}>{p.highestBid} CR</strong>
          <span style={{ color: '#82a49a', fontSize: '11px', display: 'block', marginTop: '4px' }}>
            {p.highestBidder}
          </span>
        </div>
      )}
      <div className="player-card">
        <div className={`player-art`}>
          <span>{x.primaryPosition}</span>
          <strong>{x.baseOverall}</strong>
          {isSuitableForTactic && (
            <div style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              boxShadow: '0 0 10px rgba(251, 191, 36, 0.6)',
              animation: 'pulse 2s infinite'
            }}>
              ⭐
            </div>
          )}
        </div>
        <div className="player-info">
          <h1>
            {x.name}
            {isSuitableForTactic && (
              <span style={{
                marginLeft: '8px',
                fontSize: '14px',
                color: '#fbbf24',
                fontWeight: 600
              }}>
                ⭐
              </span>
            )}
          </h1>
          <p>
            {t.positions[x.primaryPosition]} · {x.age} {t.years} · {x.archetype}
          </p>
          {isSuitableForTactic && (
            <div style={{
              marginTop: '8px',
              padding: '6px 10px',
              background: 'rgba(251, 191, 36, 0.15)',
              border: '1px solid rgba(251, 191, 36, 0.4)',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#fbbf24',
              fontWeight: 600,
              textAlign: 'center'
            }}>
              ⭐ Taktiğine uygun oyuncu!
            </div>
          )}
          <div className="tier">
            {x.marketTier.toUpperCase()}
            <small>{t.quality}</small>
          </div>
          <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(132, 204, 22, 0.1)', borderRadius: '6px', border: '1px solid rgba(132, 204, 22, 0.3)' }}>
            <small style={{ display: 'block', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              {p.language === 'tr' ? 'Tahmini Piyasa Değeri' : 'Est. Market Value'}
            </small>
            <strong style={{ fontSize: '18px', color: '#84cc16', fontFamily: 'var(--font-heading)' }}>
              {x.marketValue || 5} CR
            </strong>
          </div>
          <div className="attributes">
            <div>
              <b>{x.attributes.pace}</b>
              PACE
            </div>
            <div>
              <b>{x.attributes.shooting}</b>
              ŞUT
            </div>
            <div>
              <b>{x.attributes.passing}</b>
              PAS
            </div>
            <div>
              <b>{x.attributes.defending}</b>
              DEF
            </div>
          </div>
        </div>
      </div>
      <div className="bid-row">
        <div className="bid-info">
          <div>
            <small style={{ fontSize: '12px', color: 'var(--color-muted-foreground)' }}>TEKLİFİN</small>
            <strong>{p.bid} CR</strong>
          </div>
          <input
            type="number"
            min={Math.max(1, p.highestBid + 1)}
            max={maxBid}
            value={p.bid}
            onChange={e => p.setBid(Math.min(maxBid, Math.max(p.highestBid + 1, +e.target.value)))}
          />
        </div>
        <div className="bid-controls">
          <input
            type="range"
            min={Math.max(1, p.highestBid + 1)}
            max={maxBid}
            value={p.bid}
            onChange={e => p.setBid(+e.target.value)}
          />
        </div>
        {/* Quick Bid Buttons */}
        <div className="quick-bid-buttons">
          <button
            onClick={() => p.setBid(Math.min(maxBid, Math.max(p.highestBid + 1, p.bid + 1)))}
            disabled={p.bid >= maxBid}
          >
            +1
          </button>
          <button
            onClick={() => p.setBid(Math.min(maxBid, Math.max(p.highestBid + 1, p.bid + 5)))}
            disabled={p.bid >= maxBid}
          >
            +5
          </button>
          <button
            onClick={() => p.setBid(Math.min(maxBid, Math.max(p.highestBid + 1, p.bid + 10)))}
            disabled={p.bid >= maxBid}
          >
            +10
          </button>
          <button
            className="max"
            onClick={() => p.setBid(maxBid)}
            disabled={p.bid >= maxBid}
          >
            MAX
          </button>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <button className="primary" onClick={() => p.buy(p.bid)} disabled={p.bid <= p.highestBid} style={{ flex: 1 }}>
            Teklif ver · {p.bid} CR
          </button>
          <button className="ghost" onClick={p.skip}>
            Pas geç
          </button>
        </div>
      </div>
      <div className="scout">
        <b>SCOUT HAKLARI</b>
        <span>Sonraki oyuncunun bilgilerini göster.</span>
        <button onClick={p.scout}>🔎 Scout kullan ({p.me.scouts})</button>
      </div>
    </div>
  );
}

// ... (Rest of components remain the same - Steal, Trade, Lineup, Tactics, Panel, Match, Result)
// Copy them from original file

function Steal(p: any) {
  const opponent = p.opponent || { roster: [] };
  const me = p.me || { roster: [] };

  return (
    <Panel title="Oyuncu çalma" subtitle="Seçimlerin gizli ve eş zamanlı uygulanır.">
      <div className="steal-grid">
        <label>
          Rakipten hedef oyuncu
          <select value={p.stealTarget} onChange={e => p.setStealTarget(e.target.value)}>
            <option value="">-- Oyuncu seç --</option>
            {opponent.roster.map((player: Player) => (
              <option key={player.id} value={player.id}>
                {player.name} · {player.primaryPosition} · {player.baseOverall}
              </option>
            ))}
          </select>
        </label>
        <label>
          Karşılığında gönder
          <select value={p.stealOffer} onChange={e => p.setStealOffer(e.target.value)}>
            <option value="">-- Oyuncu seç --</option>
            {me.roster.map((player: Player) => (
              <option key={player.id} value={player.id}>
                {player.name} · {player.primaryPosition} · {player.baseOverall}
              </option>
            ))}
          </select>
        </label>
        <label>
          Korumak istediğin oyuncu
          <select value={p.stealProtect} onChange={e => p.setStealProtect(e.target.value)}>
            <option value="">-- Oyuncu seç --</option>
            {me.roster.map((player: Player) => (
              <option key={player.id} value={player.id}>
                {player.name} · {player.primaryPosition} · {player.baseOverall}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="primary" onClick={p.submitSteal}>
        Seçimi kilitle →
      </button>
    </Panel>
  );
}

function Trade(p: any) {
  const { tradeOffers, me } = p;

  if (!tradeOffers || tradeOffers.length === 0) {
    return (
      <Panel title="Serbest takas" subtitle="Çalma fazı tamamlandı. Takas teklifi yok.">
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ab3a8' }}>
          <p>Bu turda takas teklifi bulunmuyor.</p>
          <p style={{ fontSize: '12px', marginTop: '10px' }}>Diziliş aşamasına geçiliyor...</p>
        </div>
        <button className="primary" onClick={() => p.acceptTrade(false)}>
          Devam et →
        </button>
      </Panel>
    );
  }

  const trade = tradeOffers[0];
  const isReceiving = trade.to === me.id;
  const theyGive = isReceiving ? trade.give : trade.want;
  const theyWant = isReceiving ? trade.want : trade.give;

  return (
    <Panel title="Takas teklifi" subtitle="Çalma fazından gelen takas teklifini kabul et veya reddet.">
      <div style={{ padding: '20px', background: 'rgba(12, 33, 28, 0.6)', borderRadius: '12px', marginBottom: '20px', border: '1px solid rgba(184, 237, 97, 0.1)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '20px', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', padding: '15px', background: 'rgba(7, 23, 19, 0.8)', borderRadius: '8px' }}>
            <small style={{ color: '#9ab3a8', fontSize: '11px', display: 'block', marginBottom: '8px' }}>
              {isReceiving ? 'Rakip Veriyor' : 'Sen Veriyorsun'}
            </small>
            <span style={{ color: '#b8ed61', fontSize: '13px', fontWeight: 600 }}>{theyGive.primaryPosition}</span>
            <h3 style={{ margin: '8px 0 4px', fontSize: '16px' }}>{theyGive.name}</h3>
            <strong style={{ color: '#b8ed61', fontSize: '20px' }}>{theyGive.baseOverall}</strong>
          </div>

          <div style={{ fontSize: '24px', color: '#9ab3a8' }}>⇄</div>

          <div style={{ textAlign: 'center', padding: '15px', background: 'rgba(7, 23, 19, 0.8)', borderRadius: '8px' }}>
            <small style={{ color: '#9ab3a8', fontSize: '11px', display: 'block', marginBottom: '8px' }}>
              {isReceiving ? 'Sen Veriyorsun' : 'Rakip Veriyor'}
            </small>
            <span style={{ color: '#b8ed61', fontSize: '13px', fontWeight: 600 }}>{theyWant.primaryPosition}</span>
            <h3 style={{ margin: '8px 0 4px', fontSize: '16px' }}>{theyWant.name}</h3>
            <strong style={{ color: '#b8ed61', fontSize: '20px' }}>{theyWant.baseOverall}</strong>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button className="primary" onClick={() => p.acceptTrade(true)} style={{ flex: 1 }}>
          ✓ Takası kabul et
        </button>
        <button className="ghost" onClick={() => p.acceptTrade(false)} style={{ flex: 1 }}>
          ✗ Reddet
        </button>
      </div>
    </Panel>
  );
}

function Lineup(p: any) {
  const myTeam = p.teams.find((t: Team) => t.id === socketService.getSocketId());
  const sortedPlayers = myTeam ? [...myTeam.roster].sort((a, b) => b.baseOverall - a.baseOverall).slice(0, 11) : [];

  const formations = [
    { name: '4-3-3', positions: ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'LW', 'ST', 'RW'] },
    { name: '4-4-2', positions: ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'] },
    { name: '3-5-2', positions: ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'CM', 'RM', 'ST', 'ST'] },
    { name: '4-2-3-1', positions: ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'DM', 'AM', 'LW', 'RW', 'ST'] },
    { name: '3-4-3', positions: ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'LW', 'ST', 'RW'] }
  ];

  return (
    <Panel title="İlk 11 ve diziliş" subtitle="En iyi 11 oyuncun otomatik seçildi. Formasyon seç ve kaydet.">
      <div style={{ marginBottom: '30px' }}>
        <label style={{ display: 'block', marginBottom: '15px', fontSize: '0.9rem', color: '#84cc16' }}>
          Formasyon seç:
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '30px' }}>
          {formations.map(f => (
            <button
              key={f.name}
              onClick={() => p.setFormation(f.name)}
              style={{
                padding: '12px',
                background: p.formation === f.name ? '#84cc16' : 'rgba(132, 204, 22, 0.1)',
                border: '1px solid rgba(132, 204, 22, 0.3)',
                borderRadius: '8px',
                color: p.formation === f.name ? '#0F172A' : '#F1F5F9',
                cursor: 'pointer',
                fontWeight: p.formation === f.name ? 700 : 500,
                fontSize: '0.9rem'
              }}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '15px', color: '#84cc16' }}>İlk 11 (En iyi overall sırasına göre):</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {sortedPlayers.map((player, idx) => (
            <div
              key={player.id}
              style={{
                padding: '12px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(132, 204, 22, 0.3)',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <span style={{ fontWeight: 600 }}>{idx + 1}. {player.name}</span>
                <span style={{ marginLeft: '10px', color: '#84cc16', fontSize: '0.85rem' }}>
                  {player.primaryPosition}
                </span>
              </div>
              <span style={{ color: '#84cc16', fontWeight: 700 }}>{player.baseOverall}</span>
            </div>
          ))}
        </div>
      </div>

      <button className="primary" onClick={p.saveLineup}>
        Dizilişi kaydet →
      </button>
    </Panel>
  );
}

function Tactics(p: any) {
  return (
    <Panel title="Taktik planı" subtitle="Seçimler server tarafından maç seed'iyle simüle edilir.">
      <div className="tactics">
        {[
          ['Mentality', ['Defensive', 'Balanced', 'Attacking']],
          ['Tempo', ['Slow', 'Normal', 'Fast']],
          ['Pressing', ['Low', 'Medium', 'High']],
          ['Defensive line', ['Deep', 'Normal', 'High']],
          ['Width', ['Narrow', 'Balanced', 'Wide']]
        ].map(([n, opts]: any) => (
          <label key={n}>
            {n}
            <select value={p.tactic} onChange={e => p.setTactic(e.target.value)}>
              {opts.map((o: string) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <button className="primary" onClick={p.sim}>
        Maçı simüle et ⚡
      </button>
    </Panel>
  );
}

function Panel(p: any) {
  return (
    <div className="panel">
      <p className="kicker">BALL ON! · HAZIRLIK</p>
      <h1>{p.title}</h1>
      <p>{p.subtitle}</p>
      {p.children}
    </div>
  );
}

function Match() {
  return (
    <div className="match">
      <div className="live">● CANLI SİMÜLASYON</div>
      <h1>
        Sen <strong>? — ?</strong> Bot Atlas
      </h1>
      <div className="timeline">
        <span>Maç simülasyonu çalışıyor...</span>
      </div>
    </div>
  );
}

function Result(p: any) {
  const result = p.result;
  if (!result) {
    return (
      <div className="result panel">
        <p className="kicker">MAÇ RAPORU</p>
        <h1>Sonuç bekleniyor...</h1>
      </div>
    );
  }

  const winner = result.homeScore > result.awayScore ? 'Galibiyet!' : result.homeScore < result.awayScore ? 'Mağlubiyet!' : 'Beraberlik!';

  return (
    <div className="result panel">
      <p className="kicker">MAÇ RAPORU</p>
      <h1>
        {winner} <em>{result.homeScore} — {result.awayScore}</em>
      </h1>
      <p>Maç tamamlandı. Taktik uyumu ve kimya sonucu belirledi.</p>
      <div className="result-stats">
        <b>
          Topa sahip olma <span>{result.stats.possession[0]}%</span>
        </b>
        <b>
          Şut <span>{result.stats.shots[0]}</span>
        </b>
        <b>
          xG <span>{result.stats.xG[0].toFixed(2)}</span>
        </b>
        <b>
          Pas <span>{result.stats.passAccuracy[0]}%</span>
        </b>
      </div>
      <button className="primary">Turnuva bracket'ine dön →</button>
    </div>
  );
}

// Auction Result Modal Component
function AuctionResultModal({ result, language, onClose }: { result: any; language: Language; onClose: () => void }) {
  const t = translations[language];

  if (!result) return null;

  return (
    <div className="auction-result-modal" onClick={onClose}>
      <div className="auction-result-content" onClick={(e) => e.stopPropagation()}>
        <div className="auction-result-header">
          <p className="kicker">{t.auctionResult}</p>
          <h2>{result.player.name}</h2>
        </div>

        <div className="auction-result-player">
          <div className="auction-result-player-art">
            <span>{result.player.primaryPosition}</span>
            <strong>{result.player.baseOverall}</strong>
          </div>
          <div className="auction-result-player-info">
            <h3>{result.player.name}</h3>
            <p>
              {t.positions[result.player.primaryPosition as keyof typeof t.positions]} · {result.player.age} {t.years} · {result.player.archetype}
            </p>
          </div>
        </div>

        {result.free ? (
          <div className="auction-result-free">
            <div className="auction-result-free-icon">🎲</div>
            <p>
              <strong>{t.noBidsReceived}</strong><br />
              {t.assignedRandomly}: <strong>{result.winner}</strong>
            </p>
          </div>
        ) : (
          <>
            <div className="auction-result-winner">
              <div className="auction-result-winner-label">{t.winner}</div>
              <div className="auction-result-winner-name">{result.winner}</div>
              <div className="auction-result-winner-amount">
                {result.amount} <small>CR</small>
              </div>
            </div>

            {result.allBidders && result.allBidders.length > 0 && (
              <div className="auction-result-bids">
                <h4>{t.allBids}</h4>
                <div className="auction-result-bid-list">
                  {result.allBidders.sort((a: any, b: any) => b.amount - a.amount).map((bidder: any, idx: number) => (
                    <div
                      key={idx}
                      className={`auction-result-bid-item ${bidder.teamName === result.winner ? 'winner' : ''}`}
                    >
                      <span>{bidder.teamName}</span>
                      <strong>{bidder.amount} CR</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Joker Reveal */}
        {result.joker && (
          <div className="auction-result-joker">
            <div className="joker-icon">🎁</div>
            <div className="joker-content">
              <div className="joker-label">
                {result.joker.type === 'budget' && t.jokerBudget}
                {result.joker.type === 'scout' && t.jokerScout}
                {result.joker.type === 'buff' && t.jokerBuff}
                {result.joker.type === 'free_transfer' && t.jokerFreeTransfer}
              </div>
              <div className="joker-description">
                <strong>{result.player.name}</strong> {result.winner} {' '}
                {result.joker.type === 'budget' && `+${result.joker.value} CR ${t.jokerRevealBudget}`}
                {result.joker.type === 'scout' && `+${result.joker.value} ${t.jokerRevealScout}`}
                {result.joker.type === 'buff' && `+${result.joker.value} ${t.jokerRevealBuff}`}
              </div>
            </div>
          </div>
        )}

        <button className="primary" onClick={onClose} style={{ width: '100%' }}>
          {t.continueButton}
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
