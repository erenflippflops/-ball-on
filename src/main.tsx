import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { socketService } from './socketService';
import type { Player, Team, Room, Phase } from './types';

const posNames: Record<string, string> = {
  GK: 'Kaleci', CB: 'Stoper', LB: 'Sol bek', RB: 'Sağ bek',
  LWB: 'Sol kanat bek', RWB: 'Sağ kanat bek',
  DM: 'Ön libero', CM: 'Merkez', AM: 'Ofansif orta saha',
  LM: 'Sol orta saha', RM: 'Sağ orta saha',
  LW: 'Sol kanat', RW: 'Sağ kanat', ST: 'Santrfor'
};

function App() {
  const [phase, setPhase] = useState<Phase>('lobby');
  const [room, setRoom] = useState('');
  const [roomId, setRoomId] = useState('');
  const [nick, setNick] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [current, setCurrent] = useState<Player | null>(null);
  const [bid, setBid] = useState(1);
  const [message, setMessage] = useState('Odayı oluştur veya mevcut bir odaya katıl.');
  const [formation, setFormation] = useState('4-3-3');
  const [tactic, setTactic] = useState('Balanced');
  const [matchResult, setMatchResult] = useState<any>(null);
  const [tradeOffers, setTradeOffers] = useState<Array<{ from: string; to: string; give: Player; want: Player }>>([]);
  const [marketTrend, setMarketTrend] = useState<'boom' | 'crash' | 'stable'>('stable');
  const [gossipStars, setGossipStars] = useState<string[]>([]);
  const [playerCount, setPlayerCount] = useState(1);
  const [auctionTimer, setAuctionTimer] = useState(30);
  const [highestBid, setHighestBid] = useState(0);
  const [highestBidder, setHighestBidder] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [competition, setCompetition] = useState('Premier League');

  // Steal phase state
  const [stealTarget, setStealTarget] = useState('');
  const [stealOffer, setStealOffer] = useState('');
  const [stealProtect, setStealProtect] = useState('');

  const me = teams.find(t => t.id === socketService.getSocketId()) || { id: '', name: '', budget: 100, roster: [], ready: false, scouts: 3, buff: 0 };
  const opponent = teams.find(t => t.id !== socketService.getSocketId()) || { id: '', name: '', budget: 100, roster: [], ready: false, scouts: 3, buff: 0 };
  const avg = me.roster.length ? Math.round(me.roster.reduce((s, p) => s + p.baseOverall, 0) / me.roster.length) : 0;

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
        setAuctionTimer(30);
        setHighestBid(0);
        setHighestBidder('');
        setBid(1);
      }
    });

    socketService.onNextPlayer((data) => {
      setCurrent(data.player);
      setAuctionTimer(30);
      setHighestBid(0);
      setHighestBidder('');
      setBid(1);
    });

    socketService.onPlayerAcquired((data: any) => {
      if (data.free) {
        setMessage(`🎲 ${data.player.name} hiç teklif almadı! Rastgele ${data.winner} takımına ücretsiz gitti.`);
      } else {
        setMessage(`✅ ${data.winner} ${data.player.name}'i ${data.amount} CR'ye aldı!`);
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
    });

    socketService.on('player_joined', (data) => {
      setMessage(`🎮 ${data.teamName} odaya katıldı!`);
    });

    socketService.on('auction_timer', (data) => {
      setAuctionTimer(data.timeLeft);
    });

    socketService.on('bid_placed', (data) => {
      setHighestBid(data.highestBid);
      setHighestBidder(data.highestBidder);
      setMessage(`${data.teamName} ${data.amount} CR teklif verdi!`);
    });

    socketService.on('player_skipped', (data) => {
      setMessage(`${data.player.name} için teklif verilmedi, geçildi.`);
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
    };
  }, []);

  const start = async () => {
    const response = await socketService.createRoom(nick || 'Oyuncu', maxPlayers, competition);
    if (response.success && response.roomId && response.room) {
      setRoomId(response.roomId);
      setRoom(response.roomId);
      setTeams(response.room.teams);
      setMessage(`${response.room.competition} odası hazır! ${response.room.maxPlayers} kişilik.`);
    } else {
      setMessage(response.error || 'Oda oluşturulamadı');
    }
  };

  const join = async () => {
    if (!room) return;
    const response = await socketService.joinRoom(room, nick || 'Oyuncu');
    if (response.success && response.room) {
      setRoomId(room);
      setTeams(response.room.teams);
      setMessage('Odaya katıldın!');
    } else {
      setMessage(response.error || 'Odaya katılınamadı');
    }
  };

  const begin = async () => {
    if (!roomId) return;
    const response = await socketService.startGame(roomId);
    if (response.success) {
      setMessage('Açık artırma başladı!');
    } else {
      setMessage(response.error || 'Oyun başlatılamadı');
    }
  };

  const buy = async (amount: number) => {
    if (!current || !roomId) return;
    if (amount > me.budget - (14 - me.roster.length)) {
      setMessage('Bu teklif kadro rezervini ihlal ediyor.');
      return;
    }

    const response = await socketService.placeBid(roomId, amount);
    if (!response.success) {
      setMessage(response.error || 'Teklif başarısız');
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
      return;
    }
    if (!roomId) return;

    const response = await socketService.useScout(roomId);
    if (response.success) {
      const { tier, playerName, position, overall } = response;
      setMessage(`🔎 Scout raporu: Sonraki oyuncu ${playerName} (${position}) - ${overall} OVR - Kalite: ${tier?.toUpperCase()}`);
    } else {
      setMessage(response.error || 'Scout kullanılamadı');
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
      return;
    }
    const response = await socketService.submitSteal(roomId, stealTarget, stealOffer, stealProtect);
    if (response.success) {
      setMessage('Seçiminiz kaydedildi, sonuçlar işleniyor...');
    } else {
      setMessage(response.error || 'Seçim başarısız');
    }
  };

  const acceptTrade = async (accept: boolean) => {
    if (!roomId) return;
    await socketService.tradeResponse(roomId, accept);
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

  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="ball">⚽</span>
          <div>
            <strong>BALL ON!</strong>
            <small>Draft Eleven Manager</small>
          </div>
        </div>
        <div className="phase">
          <span>FAZ</span>
          <b>{phase.toUpperCase()}</b>
        </div>
        <div className="room">{room && <>ODA <b>{room}</b></>}</div>
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
        ) : (
          <Game
            phase={phase}
            me={me}
            opponent={opponent}
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
          />
        )}
      </main>
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
  const { me, current } = p;

  // Calculate position stats
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
        <div style={{ margin: '15px 0', padding: '12px', background: '#0a1a15', borderRadius: '8px', border: '1px solid #1a3329' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '11px', color: '#9ab3a8', fontWeight: 600 }}>POZİSYON DAĞILIMI</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
            {Object.entries(positionStats).map(([pos, count]) => (
              <div key={pos} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: '#071713', borderRadius: '4px' }}>
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
        <div className="roster">
          {me.roster.map((x: Player) => (
            <div className="roster-row" key={x.id}>
              <span className={`mini ${x.primaryPosition}`}>{x.primaryPosition}</span>
              <span>{x.name}</span>
              <b>{x.baseOverall}</b>
            </div>
          ))}
          {Array.from({ length: Math.max(0, 14 - me.roster.length) }).map((_, i) => (
            <div className="empty" key={i}>
              + boş slot
            </div>
          ))}
        </div>
      </aside>
      <div className="board">
        <div className="notice">{p.message}</div>
        {p.phase === 'auction' && <Auction {...p} />}
        {p.phase === 'steal' && <Steal {...p} />}
        {p.phase === 'trade' && <Trade {...p} />}
        {p.phase === 'lineup' && <Lineup {...p} />}
        {p.phase === 'tactics' && <Tactics {...p} />}
        {p.phase === 'match' && <Match />}
        {p.phase === 'result' && <Result result={p.matchResult} />}
      </div>
      <aside className="rightbar">
        <h3>PİYASA DURUMU</h3>
        <div style={{ padding: '12px', background: '#112c24', borderRadius: '5px', marginBottom: '15px' }}>
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
            <div style={{ padding: '10px', background: '#112c24', borderRadius: '5px', marginBottom: '15px' }}>
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
  if (!x) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="auction">
      <div className="auction-top">
        <span className="kicker">AÇIK ARTIRMA · {p.me.roster.length + 1}. TUR</span>
        <span className="timer" style={{ color: p.auctionTimer <= 10 ? '#ff7b6e' : '#b8ed61' }}>
          {formatTime(p.auctionTimer)}
        </span>
      </div>
      {p.highestBid > 0 && (
        <div style={{ padding: '12px', background: '#102d25', borderRadius: '5px', marginBottom: '15px', textAlign: 'center' }}>
          <small style={{ color: '#9ab3a8', fontSize: '11px', display: 'block' }}>EN YÜKSEK TEKLİF</small>
          <strong style={{ color: '#b8ed61', fontSize: '20px' }}>{p.highestBid} CR</strong>
          <span style={{ color: '#82a49a', fontSize: '11px', display: 'block', marginTop: '4px' }}>
            {p.highestBidder}
          </span>
        </div>
      )}
      <div className="player-card">
        <div className={`player-art ${x.primaryPosition}`}>
          <span>{x.primaryPosition}</span>
          <strong>{x.baseOverall}</strong>
        </div>
        <div>
          <h1>{x.name}</h1>
          <p>
            {posNames[x.primaryPosition]} · {x.age} yaş · {x.archetype}
          </p>
          <div className="attributes">
            <span>
              PACE <b>{x.attributes.pace}</b>
            </span>
            <span>
              ŞUT <b>{x.attributes.shooting}</b>
            </span>
            <span>
              PAS <b>{x.attributes.passing}</b>
            </span>
            <span>
              DEF <b>{x.attributes.defending}</b>
            </span>
          </div>
        </div>
        <div className="tier">
          {x.marketTier.toUpperCase()}
          <small>kalite</small>
        </div>
      </div>
      <div className="bid-row">
        <div>
          <small>TEKLİFİN</small>
          <strong>{p.bid} CR</strong>
        </div>
        <input
          type="range"
          min={Math.max(1, p.highestBid + 1)}
          max={Math.max(1, p.me.budget - (14 - p.me.roster.length))}
          value={p.bid}
          onChange={e => p.setBid(+e.target.value)}
        />
        <button className="primary" onClick={() => p.buy(p.bid)} disabled={p.bid <= p.highestBid}>
          Teklif ver · {p.bid} CR
        </button>
        <button onClick={() => p.buy(Math.max(p.highestBid + 1, p.me.budget - (14 - p.me.roster.length)))}>ALL-IN</button>
        <button className="ghost" onClick={p.skip}>
          Pas geç
        </button>
      </div>
      <div className="scout">
        <b>SCOUT HAKLARI</b>
        <span>Sonraki oyuncunun bilgilerini göster.</span>
        <button onClick={p.scout}>🔎 Scout kullan ({p.me.scouts})</button>
      </div>
    </div>
  );
}

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
  const { tradeOffers, me, opponent } = p;

  // If there are no trade offers, show a simple message
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

  // Show the first trade offer
  const trade = tradeOffers[0];
  const isReceiving = trade.to === me.id;
  const theyGive = isReceiving ? trade.give : trade.want;
  const theyWant = isReceiving ? trade.want : trade.give;

  return (
    <Panel title="Takas teklifi" subtitle="Çalma fazından gelen takas teklifini kabul et veya reddet.">
      <div style={{ padding: '20px', background: '#0c211c', borderRadius: '8px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '20px', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', padding: '15px', background: '#071713', borderRadius: '8px' }}>
            <small style={{ color: '#9ab3a8', fontSize: '11px', display: 'block', marginBottom: '8px' }}>
              {isReceiving ? 'Rakip Veriyor' : 'Sen Veriyorsun'}
            </small>
            <span style={{ color: '#b8ed61', fontSize: '13px', fontWeight: 600 }}>{theyGive.primaryPosition}</span>
            <h3 style={{ margin: '8px 0 4px', fontSize: '16px' }}>{theyGive.name}</h3>
            <strong style={{ color: '#b8ed61', fontSize: '20px' }}>{theyGive.baseOverall}</strong>
          </div>

          <div style={{ fontSize: '24px', color: '#9ab3a8' }}>⇄</div>

          <div style={{ textAlign: 'center', padding: '15px', background: '#071713', borderRadius: '8px' }}>
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
  const me = p.me || { roster: [] };

  // Helper to get position category
  const getPositionCat = (pos: string) => {
    if (pos === 'GK') return 'GK';
    if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'DEF';
    if (['DM', 'CM', 'AM', 'LM', 'RM'].includes(pos)) return 'MID';
    return 'ATT';
  };

  // Formation requirements: [GK, DEF, MID, ATT]
  const formations: Record<string, number[]> = {
    '4-3-3': [1, 4, 3, 3],
    '4-4-2': [1, 4, 4, 2],
    '4-2-3-1': [1, 4, 5, 1],
    '3-5-2': [1, 3, 5, 2]
  };

  const formationNeeds = formations[p.formation] || [1, 4, 3, 3];

  // Auto-select best 11 based on formation needs
  const selectBest11 = () => {
    const selected: Player[] = [];
    const remaining = [...me.roster];

    // Sort by overall within each category
    const byCategory: Record<string, Player[]> = {
      GK: remaining.filter(p => getPositionCat(p.primaryPosition) === 'GK').sort((a, b) => b.baseOverall - a.baseOverall),
      DEF: remaining.filter(p => getPositionCat(p.primaryPosition) === 'DEF').sort((a, b) => b.baseOverall - a.baseOverall),
      MID: remaining.filter(p => getPositionCat(p.primaryPosition) === 'MID').sort((a, b) => b.baseOverall - a.baseOverall),
      ATT: remaining.filter(p => getPositionCat(p.primaryPosition) === 'ATT').sort((a, b) => b.baseOverall - a.baseOverall)
    };

    // Pick by formation needs
    const categories = ['GK', 'DEF', 'MID', 'ATT'];
    categories.forEach((cat, idx) => {
      const needed = formationNeeds[idx];
      const available = byCategory[cat];
      selected.push(...available.slice(0, needed));
    });

    // Fill remaining slots with best overall players if we don't have 11
    if (selected.length < 11) {
      const alreadySelected = new Set(selected.map(p => p.id));
      const others = me.roster
        .filter((p: Player) => !alreadySelected.has(p.id))
        .sort((a: Player, b: Player) => b.baseOverall - a.baseOverall);
      selected.push(...others.slice(0, 11 - selected.length));
    }

    return selected.slice(0, 11);
  };

  const best11 = selectBest11();

  // Position mapping for visual display based on formation
  const getSlotPositions = () => {
    const gk = best11.filter(p => getPositionCat(p.primaryPosition) === 'GK')[0];
    const def = best11.filter(p => getPositionCat(p.primaryPosition) === 'DEF');
    const mid = best11.filter(p => getPositionCat(p.primaryPosition) === 'MID');
    const att = best11.filter(p => getPositionCat(p.primaryPosition) === 'ATT');

    const slots: Array<{ player: Player; style: React.CSSProperties }> = [];

    // GK (always bottom center)
    if (gk) {
      slots.push({
        player: gk,
        style: { left: '47%', bottom: '10px' }
      });
    }

    // DEF positions based on formation
    if (p.formation === '4-3-3' || p.formation === '4-4-2' || p.formation === '4-2-3-1') {
      // 4 defenders
      const defPositions = [
        { left: '10%', bottom: '80px' },   // LB
        { left: '35%', bottom: '70px' },   // LCB
        { left: '60%', bottom: '70px' },   // RCB
        { right: '10%', bottom: '80px' }   // RB
      ];
      def.slice(0, 4).forEach((player, i) => {
        slots.push({ player, style: defPositions[i] });
      });
    } else if (p.formation === '3-5-2') {
      // 3 defenders
      const defPositions = [
        { left: '25%', bottom: '75px' },   // LCB
        { left: '47%', bottom: '70px' },   // CB
        { left: '70%', bottom: '75px' }    // RCB
      ];
      def.slice(0, 3).forEach((player, i) => {
        slots.push({ player, style: defPositions[i] });
      });
    }

    // MID positions based on formation
    if (p.formation === '4-3-3') {
      // 3 midfielders
      const midPositions = [
        { left: '25%', bottom: '160px' },  // LCM
        { left: '47%', bottom: '155px' },  // CM
        { left: '70%', bottom: '160px' }   // RCM
      ];
      mid.slice(0, 3).forEach((player, i) => {
        slots.push({ player, style: midPositions[i] });
      });
    } else if (p.formation === '4-4-2') {
      // 4 midfielders
      const midPositions = [
        { left: '10%', bottom: '160px' },  // LM
        { left: '35%', bottom: '155px' },  // LCM
        { left: '60%', bottom: '155px' },  // RCM
        { right: '10%', bottom: '160px' }  // RM
      ];
      mid.slice(0, 4).forEach((player, i) => {
        slots.push({ player, style: midPositions[i] });
      });
    } else if (p.formation === '4-2-3-1') {
      // 5 midfielders (2 CDM + 3 CAM)
      const midPositions = [
        { left: '35%', bottom: '145px' },  // LCDM
        { left: '60%', bottom: '145px' },  // RCDM
        { left: '10%', bottom: '220px' },  // LAM
        { left: '47%', bottom: '215px' },  // CAM
        { right: '10%', bottom: '220px' }  // RAM
      ];
      mid.slice(0, 5).forEach((player, i) => {
        slots.push({ player, style: midPositions[i] });
      });
    } else if (p.formation === '3-5-2') {
      // 5 midfielders
      const midPositions = [
        { left: '5%', bottom: '165px' },   // LWB
        { left: '28%', bottom: '155px' },  // LCM
        { left: '47%', bottom: '150px' },  // CM
        { left: '67%', bottom: '155px' },  // RCM
        { right: '5%', bottom: '165px' }   // RWB
      ];
      mid.slice(0, 5).forEach((player, i) => {
        slots.push({ player, style: midPositions[i] });
      });
    }

    // ATT positions based on formation
    if (p.formation === '4-3-3') {
      // 3 attackers
      const attPositions = [
        { left: '15%', bottom: '260px' },  // LW
        { left: '47%', bottom: '255px' },  // ST
        { right: '15%', bottom: '260px' }  // RW
      ];
      att.slice(0, 3).forEach((player, i) => {
        slots.push({ player, style: attPositions[i] });
      });
    } else if (p.formation === '4-4-2') {
      // 2 strikers
      const attPositions = [
        { left: '35%', bottom: '260px' },  // LST
        { left: '60%', bottom: '260px' }   // RST
      ];
      att.slice(0, 2).forEach((player, i) => {
        slots.push({ player, style: attPositions[i] });
      });
    } else if (p.formation === '4-2-3-1') {
      // 1 striker
      const attPositions = [
        { left: '47%', bottom: '280px' }   // ST
      ];
      att.slice(0, 1).forEach((player, i) => {
        slots.push({ player, style: attPositions[i] });
      });
    } else if (p.formation === '3-5-2') {
      // 2 strikers
      const attPositions = [
        { left: '35%', bottom: '265px' },  // LST
        { left: '60%', bottom: '265px' }   // RST
      ];
      att.slice(0, 2).forEach((player, i) => {
        slots.push({ player, style: attPositions[i] });
      });
    }

    return slots;
  };

  const positionedPlayers = getSlotPositions();

  return (
    <Panel title="İlk 11 ve diziliş" subtitle="En iyi 11 oyuncun otomatik seçildi. Formasyon seç ve kaydet.">
      <div className="formation">
        <select value={p.formation} onChange={e => p.setFormation(e.target.value)}>
          <option>4-3-3</option>
          <option>4-4-2</option>
          <option>4-2-3-1</option>
          <option>3-5-2</option>
        </select>
        <div className="pitch">
          {positionedPlayers.map(({ player, style }) => (
            <span key={player.id} className="slot" style={style} title={player.name}>
              {player.primaryPosition}
            </span>
          ))}
        </div>
      </div>
      <div style={{ marginTop: '20px', padding: '15px', background: '#0c211c', borderRadius: '8px' }}>
        <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#b8ed61' }}>İLK 11 ({best11.length}/11)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {best11.map(player => (
            <div key={player.id} style={{ fontSize: '11px', padding: '6px', background: '#071713', borderRadius: '4px' }}>
              <span style={{ color: '#b8ed61' }}>{player.primaryPosition}</span> {player.name} <b>({player.baseOverall})</b>
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

createRoot(document.getElementById('root')!).render(<App />);
