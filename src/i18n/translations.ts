export type Language = 'tr' | 'en' | 'de';

export const translations = {
  tr: {
    // Menu
    menuTitle: 'Stadyum senin.',
    menuSubtitle: 'Bilgi senin silahın.',
    menuDescription: "Amo Arena'da 2–6 oyuncu, 10 tur ve 7 farklı oyun mekaniğiyle futbol bilgisini sahaya taşı.",
    createRoom: 'Oda Oluştur',
    joinRoom: 'Odaya Katıl',

    // Create room
    createTitle: 'Odanı hazırla',
    createSubtitle: 'Arkadaşlarınla aynı sahaya çık.',
    playerName: 'OYUNCU ADIN',
    playerNamePlaceholder: 'Örn. Alex',
    gameMode: 'OYUN MODU',
    soloMode: 'Solo',
    soloModeDesc: 'Herkes kendisi için',
    teamMode: 'Takım',
    teamModeDesc: 'A vs B kapışması',

    // Join room
    joinTitle: 'Odaya katıl',
    joinSubtitle: 'Kodunu gir, takımını bul.',
    roomCode: 'ODA KODU',
    roomCodePlaceholder: 'A3F9X2',

    // Lobby
    lobbyTitle: 'Takımını topla.',
    shareCode: 'Kodu arkadaşlarınla paylaş',
    players: 'OYUNCULAR',
    waitingForPlayers: 'Oyuncu bekleniyor…',
    waitingForHost: 'Host oyunu başlatmayı bekliyor…',
    startGame: 'Oyunu Başlat',
    minPlayersRequired: 'En az 2 oyuncu gerekli',
    you: 'SEN',
    host: 'HOST',
    teamA: 'TAKIM A',
    teamB: 'TAKIM B',

    // Game
    round: 'ROUND',
    timeLeft: 'süre',
    answered: 'cevapladı',
    submitAnswer: 'Cevabı Gönder',
    answerSubmitted: 'Cevabın gönderildi',
    gameStatus: 'OYUN DURUMU',
    scoring: 'PUANLAMA',
    scoringDesc: 'Hızlı cevap, fazla puan.',
    scoringDetails: 'İlk 3 doğru +30% / +20% / +10%\n3\'lü seri +50%',

    // Question types
    multipleChoice: 'Hızlı Seçim',
    lightning: 'Lightning Round',
    top5: 'Top 5',
    statDetective: 'Stat Detective',
    formationBuilder: 'Formation Builder',
    careerPath: 'Career Path',
    matchMaker: 'Match Maker',

    // Results
    roundComplete: 'TAMAMLANDI',
    roundSummary: 'Bu turun özeti.',
    answerKey: 'CEVAP ANAHTARI AÇILDI',
    nextRound: 'Sonraki Round',
    finalResults: 'Final Sonuçlar',
    gameOver: 'Maç bitti.',
    finalRanking: 'Sıralama belli.',
    points: 'PUAN',
    playAgain: 'Yeniden Oyna',

    // Errors
    enterName: 'İsim gir!',
    enterRoomCode: 'Oda kodu gir!',
    roomNotFound: 'Oda bulunamadı',
    roomFull: 'Oda dolu (6/6)',
    gameStarted: 'Oyun başlamış',
    hostLeft: 'Host ayrıldı; oda kapatıldı.',
    answerFailed: 'Cevap gönderilemedi',

    // Common
    back: 'Ana menü',
    exit: 'Çıkış',
    liveGame: 'CANLI OYUN',
    amoArena: 'AMO ARENA',
    tagline: 'Futbol bilgini sahaya çıkar.',
  },
  en: {
    // Menu
    menuTitle: 'The stadium is yours.',
    menuSubtitle: 'Knowledge is your weapon.',
    menuDescription: 'In Amo Arena, 2–6 players compete across 10 rounds with 7 different game mechanics testing football knowledge.',
    createRoom: 'Create Room',
    joinRoom: 'Join Room',

    // Create room
    createTitle: 'Set up your room',
    createSubtitle: 'Step onto the field with friends.',
    playerName: 'PLAYER NAME',
    playerNamePlaceholder: 'e.g. Alex',
    gameMode: 'GAME MODE',
    soloMode: 'Solo',
    soloModeDesc: 'Every player for themselves',
    teamMode: 'Team',
    teamModeDesc: 'Team A vs Team B',

    // Join room
    joinTitle: 'Join a room',
    joinSubtitle: 'Enter code, find your team.',
    roomCode: 'ROOM CODE',
    roomCodePlaceholder: 'A3F9X2',

    // Lobby
    lobbyTitle: 'Gather your team.',
    shareCode: 'Share code with friends',
    players: 'PLAYERS',
    waitingForPlayers: 'Waiting for player…',
    waitingForHost: 'Waiting for host to start…',
    startGame: 'Start Game',
    minPlayersRequired: 'At least 2 players required',
    you: 'YOU',
    host: 'HOST',
    teamA: 'TEAM A',
    teamB: 'TEAM B',

    // Game
    round: 'ROUND',
    timeLeft: 'left',
    answered: 'answered',
    submitAnswer: 'Submit Answer',
    answerSubmitted: 'Answer submitted',
    gameStatus: 'GAME STATUS',
    scoring: 'SCORING',
    scoringDesc: 'Fast answer, more points.',
    scoringDetails: 'Top 3 correct +30% / +20% / +10%\n3-streak +50%',

    // Question types
    multipleChoice: 'Quick Pick',
    lightning: 'Lightning Round',
    top5: 'Top 5',
    statDetective: 'Stat Detective',
    formationBuilder: 'Formation Builder',
    careerPath: 'Career Path',
    matchMaker: 'Match Maker',

    // Results
    roundComplete: 'COMPLETE',
    roundSummary: 'Round summary.',
    answerKey: 'ANSWER KEY REVEALED',
    nextRound: 'Next Round',
    finalResults: 'Final Results',
    gameOver: 'Game over.',
    finalRanking: 'Rankings revealed.',
    points: 'POINTS',
    playAgain: 'Play Again',

    // Errors
    enterName: 'Enter a name!',
    enterRoomCode: 'Enter room code!',
    roomNotFound: 'Room not found',
    roomFull: 'Room is full (6/6)',
    gameStarted: 'Game already started',
    hostLeft: 'Host disconnected; room closed.',
    answerFailed: 'Failed to submit answer',

    // Common
    back: 'Main menu',
    exit: 'Exit',
    liveGame: 'LIVE GAME',
    amoArena: 'AMO ARENA',
    tagline: 'Bring your football knowledge to the field.',
  },
  de: {
    // Menu
    menuTitle: 'Das Stadion gehört dir.',
    menuSubtitle: 'Wissen ist deine Waffe.',
    menuDescription: 'In Amo Arena treten 2–6 Spieler in 10 Runden mit 7 verschiedenen Spielmechaniken an, um ihr Fußballwissen zu testen.',
    createRoom: 'Raum erstellen',
    joinRoom: 'Raum beitreten',

    // Create room
    createTitle: 'Richte deinen Raum ein',
    createSubtitle: 'Betrete das Spielfeld mit Freunden.',
    playerName: 'SPIELERNAME',
    playerNamePlaceholder: 'z.B. Alex',
    gameMode: 'SPIELMODUS',
    soloMode: 'Solo',
    soloModeDesc: 'Jeder für sich',
    teamMode: 'Team',
    teamModeDesc: 'Team A gegen Team B',

    // Join room
    joinTitle: 'Einem Raum beitreten',
    joinSubtitle: 'Code eingeben, Team finden.',
    roomCode: 'RAUMCODE',
    roomCodePlaceholder: 'A3F9X2',

    // Lobby
    lobbyTitle: 'Versammle dein Team.',
    shareCode: 'Code mit Freunden teilen',
    players: 'SPIELER',
    waitingForPlayers: 'Warte auf Spieler…',
    waitingForHost: 'Warte auf Host zum Starten…',
    startGame: 'Spiel starten',
    minPlayersRequired: 'Mindestens 2 Spieler erforderlich',
    you: 'DU',
    host: 'HOST',
    teamA: 'TEAM A',
    teamB: 'TEAM B',

    // Game
    round: 'RUNDE',
    timeLeft: 'übrig',
    answered: 'beantwortet',
    submitAnswer: 'Antwort senden',
    answerSubmitted: 'Antwort gesendet',
    gameStatus: 'SPIELSTATUS',
    scoring: 'PUNKTEVERGABE',
    scoringDesc: 'Schnelle Antwort, mehr Punkte.',
    scoringDetails: 'Top 3 korrekt +30% / +20% / +10%\n3er-Serie +50%',

    // Question types
    multipleChoice: 'Schnellauswahl',
    lightning: 'Blitzrunde',
    top5: 'Top 5',
    statDetective: 'Stat Detektiv',
    formationBuilder: 'Aufstellungs-Builder',
    careerPath: 'Karrierepfad',
    matchMaker: 'Match Maker',

    // Results
    roundComplete: 'ABGESCHLOSSEN',
    roundSummary: 'Rundenzusammenfassung.',
    answerKey: 'LÖSUNGSSCHLÜSSEL ENTHÜLLT',
    nextRound: 'Nächste Runde',
    finalResults: 'Endergebnisse',
    gameOver: 'Spiel vorbei.',
    finalRanking: 'Rangliste enthüllt.',
    points: 'PUNKTE',
    playAgain: 'Nochmal spielen',

    // Errors
    enterName: 'Namen eingeben!',
    enterRoomCode: 'Raumcode eingeben!',
    roomNotFound: 'Raum nicht gefunden',
    roomFull: 'Raum ist voll (6/6)',
    gameStarted: 'Spiel bereits gestartet',
    hostLeft: 'Host getrennt; Raum geschlossen.',
    answerFailed: 'Antwort konnte nicht gesendet werden',

    // Common
    back: 'Hauptmenü',
    exit: 'Beenden',
    liveGame: 'LIVE-SPIEL',
    amoArena: 'AMO ARENA',
    tagline: 'Bringe dein Fußballwissen aufs Spielfeld.',
  }
};

export type TranslationKey = keyof typeof translations.tr;
