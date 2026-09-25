// Internationalization system for Amo Arena
export type Language = 'tr' | 'en' | 'de';

export const translations = {
  tr: {
    roomNotFound: 'Oda bulunamadı',
    roomFull: 'Oda dolu (6/6)',
    gameStarted: 'Oyun başlamış',
    onlyHostCanStart: 'Yalnızca host oyunu başlatabilir',
    minTwoPlayers: 'En az 2 oyuncu gerekli',
    noActiveQuestion: 'Aktif soru yok',
    alreadyAnswered: 'Cevabın zaten gönderildi',
    playerNotFound: 'Oyuncu bulunamadı',
    onlyHostCanEnd: 'Yalnızca host turu bitirebilir',
    roundNotActive: 'Tur aktif değil',
    notOnResults: 'Sonuç ekranında değilsin',
    onlyHostCanNext: 'Yalnızca host sonraki turu başlatabilir',
    answerTooLate: 'Süre doldu, cevap geç kaldı',
    hostLeft: 'Host ayrıldı; oda kapatıldı',
  },
  en: {
    roomNotFound: 'Room not found',
    roomFull: 'Room is full (6/6)',
    gameStarted: 'Game already started',
    onlyHostCanStart: 'Only host can start the game',
    minTwoPlayers: 'At least 2 players required',
    noActiveQuestion: 'No active question',
    alreadyAnswered: 'Already answered',
    playerNotFound: 'Player not found',
    onlyHostCanEnd: 'Only host can end round',
    roundNotActive: 'Round not active',
    notOnResults: 'Not on results screen',
    onlyHostCanNext: 'Only host can start next round',
    answerTooLate: 'Time expired, answer too late',
    hostLeft: 'Host disconnected; room closed',
  },
  de: {
    roomNotFound: 'Raum nicht gefunden',
    roomFull: 'Raum ist voll (6/6)',
    gameStarted: 'Spiel bereits gestartet',
    onlyHostCanStart: 'Nur Host kann Spiel starten',
    minTwoPlayers: 'Mindestens 2 Spieler erforderlich',
    noActiveQuestion: 'Keine aktive Frage',
    alreadyAnswered: 'Bereits geantwortet',
    playerNotFound: 'Spieler nicht gefunden',
    onlyHostCanEnd: 'Nur Host kann Runde beenden',
    roundNotActive: 'Runde nicht aktiv',
    notOnResults: 'Nicht im Ergebnisbildschirm',
    onlyHostCanNext: 'Nur Host kann nächste Runde starten',
    answerTooLate: 'Zeit abgelaufen, Antwort zu spät',
    hostLeft: 'Host getrennt; Raum geschlossen',
  },
};

export function t(lang: Language, key: keyof typeof translations.tr): string {
  return translations[lang]?.[key] || translations.en[key] || key;
}
