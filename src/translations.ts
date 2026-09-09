// translations.ts - Language system
export type Language = 'tr' | 'en';

export const translations = {
  tr: {
    // Header
    phase: 'FAZ',
    room: 'ODA',

    // Lobby
    lobbyKicker: 'GERÇEK ZAMANLI KADRO KURMA',
    lobbyTitle1: 'Takımını kur.',
    lobbyTitle2: 'Oyunu değiştir.',
    lobbySubtitle: 'Gizli oyuncu havuzundan teklif ver, rakipten oyuncu çal, doğru kimyayla turnuvayı kazan.',
    joinGame: 'Oyuna katıl',
    nickname: 'Takma ad',
    nicknamePlaceholder: 'Örn. Kartal11',
    tournament: 'Turnuva / Lig',
    maxPlayers: 'Maksimum oyuncu sayısı',
    createRoom: '+ Yeni oda oluştur',
    or: 'veya',
    roomCode: 'ODA KODU',
    joinButton: 'Katıl',
    players: 'Oyuncu',
    ready: 'Hazır',
    startGame: 'Oyunu başlat →',
    serverInfo: 'Server authoritative · Seed tabanlı simülasyon · Türkçe',

    // Sidebar
    budget: 'BÜTÇE',
    squad: 'KADRO',
    avgOvr: 'ORT. OVR',
    scout: 'SCOUT',
    buff: 'BUFF',
    positionDistribution: 'POZİSYON DAĞILIMI',
    emptySlot: '+ boş slot',

    // Auction
    auctionKicker: 'AÇIK ARTIRMA',
    round: 'TUR',
    highestBid: 'EN YÜKSEK TEKLİF',
    yourBid: 'TEKLİFİN',
    placeBid: 'Teklif ver',
    allIn: 'ALL-IN',
    pass: 'Pas geç',
    scoutRights: 'SCOUT HAKLARI',
    scoutDesc: 'Sonraki oyuncunun bilgilerini göster.',
    useScout: '🔎 Scout kullan',

    // Player card
    years: 'yaş',
    quality: 'kalite',
    pace: 'PACE',
    shooting: 'ŞUT',
    passing: 'PAS',
    defending: 'DEF',

    // Positions
    positions: {
      GK: 'Kaleci', CB: 'Stoper', LB: 'Sol bek', RB: 'Sağ bek',
      LWB: 'Sol kanat bek', RWB: 'Sağ kanat bek',
      DM: 'Ön libero', CM: 'Merkez', AM: 'Ofansif orta saha',
      LM: 'Sol orta saha', RM: 'Sağ orta saha',
      LW: 'Sol kanat', RW: 'Sağ kanat', ST: 'Santrfor'
    },

    // Notifications
    playerJoined: 'odaya katıldı!',
    auctionStarted: 'Açık artırma başladı!',
    playerWon: 'kazandı!',
    boughtFor: "CR'ye alındı!",
    noBids: 'hiç teklif almadı! Rastgele',
    freeTransfer: 'takımına ücretsiz gitti.',
    bidPlaced: 'CR teklif verdi!',
    passed: 'pas geçti.',
    timeExtended: '⏱️ Son saniye teklifi! +3 saniye eklendi',

    // Auction result modal
    auctionResult: 'Açık Artırma Sonucu',
    winner: 'KAZANAN',
    allBids: 'TÜM TEKLİFLER',
    noBidsReceived: 'Hiç teklif verilmedi',
    assignedRandomly: 'Rastgele atandı',
    continueButton: 'Devam et →',

    // Errors
    roomNotFound: 'Oda bulunamadı',
    couldNotCreate: 'Oda oluşturulamadı',
    couldNotJoin: 'Odaya katılınamadı',
    budgetViolation: 'Bu teklif kadro rezervini ihlal ediyor.',
    noScouts: 'Scout hakkın kalmadı.',

    // Jokers
    jokerBudget: 'BÜTÇE BONUSU',
    jokerScout: 'SCOUT BONUSU',
    jokerBuff: 'BUFF BONUSU',
    jokerFreeTransfer: 'SERBEST TRANSFER',
    jokerRevealBudget: 'ekstra bütçe kazandırdı!',
    jokerRevealScout: 'scout hakkı kazandırdı!',
    jokerRevealBuff: 'buff kazandırdı!',
    jokerRevealFreeTransfer: 'Serbest transfer! Minimum teklif',

    // Other phases
    stealPhase: 'Oyuncu çalma',
    tradePhase: 'Serbest takas',
    lineupPhase: 'İlk 11 ve diziliş',
    tacticsPhase: 'Taktik planı',
    matchPhase: 'Maç',
    halftimePhase: 'Devre Arası',
    resultPhase: 'Maç Raporu',

    // Halftime Transfer Window
    halftimeKicker: 'DEVRE ARASI TRANSFER PENCERESI',
    halftimeTitle: 'Transfer Zamanı',
    halftimeSubtitle: 'Oyuncu sat, takas teklifi gönder veya al. Süre dolmadan takımını güçlendir!',
    halftimeTimer: 'Kalan Süre',
    sellPlayer: 'Oyuncu Sat',
    sellPrice: 'Satış Fiyatı',
    sellButton: 'Satışa Çıkar',
    makeOffer: 'Takas Teklifi Yap',
    selectPlayer: 'Oyuncu Seç',
    wantPlayer: 'İstediğin Oyuncu',
    sendOffer: 'Teklif Gönder',
    incomingOffers: 'Gelen Teklifler',
    noOffers: 'Henüz teklif yok',
    accept: 'Kabul Et',
    reject: 'Reddet',
    finishHalftime: 'Devam Et →',
    playerSold: 'Oyuncu satıldı!',
    offerSent: 'Teklif gönderildi!',
    offerAccepted: 'Teklif kabul edildi!'
  },
  en: {
    // Header
    phase: 'PHASE',
    room: 'ROOM',

    // Lobby
    lobbyKicker: 'REAL-TIME DRAFT MANAGER',
    lobbyTitle1: 'Build your team.',
    lobbyTitle2: 'Change the game.',
    lobbySubtitle: 'Bid from hidden player pool, steal from opponent, win the tournament with perfect chemistry.',
    joinGame: 'Join Game',
    nickname: 'Nickname',
    nicknamePlaceholder: 'E.g. Eagle11',
    tournament: 'Tournament / League',
    maxPlayers: 'Maximum players',
    createRoom: '+ Create new room',
    or: 'or',
    roomCode: 'ROOM CODE',
    joinButton: 'Join',
    players: 'Players',
    ready: 'Ready',
    startGame: 'Start game →',
    serverInfo: 'Server authoritative · Seed-based simulation · English',

    // Sidebar
    budget: 'BUDGET',
    squad: 'SQUAD',
    avgOvr: 'AVG OVR',
    scout: 'SCOUT',
    buff: 'BUFF',
    positionDistribution: 'POSITION DISTRIBUTION',
    emptySlot: '+ empty slot',

    // Auction
    auctionKicker: 'AUCTION',
    round: 'ROUND',
    highestBid: 'HIGHEST BID',
    yourBid: 'YOUR BID',
    placeBid: 'Place bid',
    allIn: 'ALL-IN',
    pass: 'Pass',
    scoutRights: 'SCOUT RIGHTS',
    scoutDesc: 'Reveal next player information.',
    useScout: '🔎 Use scout',

    // Player card
    years: 'years old',
    quality: 'quality',
    pace: 'PACE',
    shooting: 'SHOT',
    passing: 'PASS',
    defending: 'DEF',

    // Positions
    positions: {
      GK: 'Goalkeeper', CB: 'Center Back', LB: 'Left Back', RB: 'Right Back',
      LWB: 'Left Wing Back', RWB: 'Right Wing Back',
      DM: 'Defensive Mid', CM: 'Center Mid', AM: 'Attacking Mid',
      LM: 'Left Mid', RM: 'Right Mid',
      LW: 'Left Wing', RW: 'Right Wing', ST: 'Striker'
    },

    // Notifications
    playerJoined: 'joined the room!',
    auctionStarted: 'Auction started!',
    playerWon: 'won!',
    boughtFor: 'bought for CR!',
    noBids: 'received no bids! Randomly assigned to',
    freeTransfer: 'for free.',
    bidPlaced: 'bid CR!',
    passed: 'passed.',
    timeExtended: '⏱️ Last second bid! +3 seconds added',

    // Auction result modal
    auctionResult: 'Auction Result',
    winner: 'WINNER',
    allBids: 'ALL BIDS',
    noBidsReceived: 'No bids received',
    assignedRandomly: 'Randomly assigned',
    continueButton: 'Continue →',

    // Errors
    roomNotFound: 'Room not found',
    couldNotCreate: 'Could not create room',
    couldNotJoin: 'Could not join room',
    budgetViolation: 'This bid violates squad reserve.',
    noScouts: 'No scout rights left.',

    // Jokers
    jokerBudget: 'BUDGET BONUS',
    jokerScout: 'SCOUT BONUS',
    jokerBuff: 'BUFF BONUS',
    jokerFreeTransfer: 'FREE TRANSFER',
    jokerRevealBudget: 'bonus budget earned!',
    jokerRevealScout: 'scout right(s) earned!',
    jokerRevealBuff: 'buff earned!',
    jokerRevealFreeTransfer: 'Free transfer! Minimum bid',

    // Other phases
    stealPhase: 'Steal Player',
    tradePhase: 'Free Trade',
    lineupPhase: 'Starting XI & Formation',
    tacticsPhase: 'Tactics',
    matchPhase: 'Match',
    halftimePhase: 'Halftime',
    resultPhase: 'Match Report',

    // Halftime Transfer Window
    halftimeKicker: 'HALFTIME TRANSFER WINDOW',
    halftimeTitle: 'Transfer Time',
    halftimeSubtitle: 'Sell players, send trade offers or buy. Strengthen your squad before time runs out!',
    halftimeTimer: 'Time Remaining',
    sellPlayer: 'Sell Player',
    sellPrice: 'Selling Price',
    sellButton: 'List for Sale',
    makeOffer: 'Make Trade Offer',
    selectPlayer: 'Select Player',
    wantPlayer: 'Player You Want',
    sendOffer: 'Send Offer',
    incomingOffers: 'Incoming Offers',
    noOffers: 'No offers yet',
    accept: 'Accept',
    reject: 'Reject',
    finishHalftime: 'Continue →',
    playerSold: 'Player sold!',
    offerSent: 'Offer sent!',
    offerAccepted: 'Offer accepted!'
  }
};

export const useTranslation = (lang: Language) => {
  return (key: string) => {
    const keys = key.split('.');
    let value: any = translations[lang];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };
};
