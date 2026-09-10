import type { Player } from './types';

export interface TacticOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  preferredArchetypes: string[];
  formations: string[];
}

export const TACTICS: TacticOption[] = [
  {
    id: 'tiki-taka',
    name: 'Tiki-Taka',
    description: 'Kısa paslarla hakimiyet. Teknik ve pasör oyuncular öne çıkar.',
    icon: '⚡',
    preferredArchetypes: [
      'Libero Kaleci',
      'Pasör Kaleci',
      'Pasör Stoper',
      'Regista',
      'Oyun Kurucu',
      'Yaratıcı Oyun Kurucu',
      'Mezzala',
      'Sahte Dokuz',
      'Yaratıcı Driplingçi',
      'İki Yönlü Orta Saha'
    ],
    formations: ['4-3-3', '4-2-3-1', '3-4-3']
  },
  {
    id: 'counter-attack',
    name: 'Hızlı Kontra',
    description: 'Savunmadan hızlı ataklar. Hız ve geçiş oyuncuları önemli.',
    icon: '⚡',
    preferredArchetypes: [
      'Hızlı Kontra Kanadı',
      'Hızlı Koşucu',
      'Geçiş Oyuncusu',
      'Box-to-box',
      'Presçi Forvet',
      'Ceza Sahası Bitiricisi',
      'Bindiren Bek',
      'Çizgi Kanat Beki',
      'Kapatıcı Stoper',
      'İçe Kat Eden Kanat'
    ],
    formations: ['4-4-2', '4-2-3-1', '5-3-2']
  },
  {
    id: 'physical-direct',
    name: 'Fiziksel Oyun',
    description: 'Güç ve hava hakimiyeti. Uzun paslar ve fiziksel mücadele.',
    icon: '💪',
    preferredArchetypes: [
      'Duvar Santrfor',
      'Hava Hâkimi',
      'Hava Topları Uzmanı',
      'Fiziksel Savunmacı',
      'Önde Savunan Stoper',
      'Ortaya Hâkim Kaleci',
      'Kapatıcı Stoper',
      'Bindiren Bek',
      'Box-to-box',
      'Kesici Stoper'
    ],
    formations: ['4-4-2', '3-5-2', '5-4-1']
  },
  {
    id: 'high-press',
    name: 'Yüksek Baskı',
    description: 'Agresif presing ve top kazanma. Dayanıklılık ve enerji önemli.',
    icon: '🔥',
    preferredArchetypes: [
      'Presçi Forvet',
      'Box-to-box',
      'Kesici Ön Libero',
      'Geçiş Oyuncusu',
      'İki Yönlü Orta Saha',
      'Bindiren Bek',
      'Önde Savunan Stoper',
      'Kesici Stoper',
      'Hızlı Koşucu',
      'Çizgi Kanat Beki'
    ],
    formations: ['4-3-3', '4-2-3-1', '3-4-3']
  },
  {
    id: 'wing-play',
    name: 'Kanat Oyunu',
    description: 'Kanatlardan ortalayarak gol. Kanatlar ve hedef adam önemli.',
    icon: '🪽',
    preferredArchetypes: [
      'Yaratıcı Kanat',
      'Hızlı Kontra Kanadı',
      'İçe Kat Eden Kanat',
      'Bindiren Bek',
      'Çizgi Kanat Beki',
      'İç Koridor Beki',
      'Duvar Santrfor',
      'Hava Hâkimi',
      'Ceza Sahası Bitiricisi',
      'Gezgin Forvet'
    ],
    formations: ['4-4-2', '4-3-3', '3-5-2']
  },
  {
    id: 'possession',
    name: 'Kontrollü Oyun',
    description: 'Top hakimiyeti ve sabırlı oyun. Dengeli ve güvenli.',
    icon: '⚖️',
    preferredArchetypes: [
      'Regista',
      'Oyun Kurucu',
      'Pasör Stoper',
      'Savunmacı Bek',
      'İki Yönlü Orta Saha',
      'Mezzala',
      'Pasör Kaleci',
      'Box-to-box',
      'Yaratıcı Oyun Kurucu',
      'Sahte Dokuz'
    ],
    formations: ['4-3-3', '4-2-3-1', '3-4-3']
  }
];

/**
 * Check if a player is suitable for the chosen tactic
 */
export function isPlayerSuitableForTactic(player: Player, tacticId: string): boolean {
  const tactic = TACTICS.find(t => t.id === tacticId);
  if (!tactic) return false;

  return tactic.preferredArchetypes.includes(player.archetype);
}

/**
 * Calculate player's tactical fit score (0-100)
 */
export function calculateTacticalFit(player: Player, tacticId: string): number {
  const tactic = TACTICS.find(t => t.id === tacticId);
  if (!tactic) return 50; // Neutral

  // Perfect match
  if (tactic.preferredArchetypes.includes(player.archetype)) {
    return 100;
  }

  // Default fit
  return 50;
}

/**
 * Get recommended formations for a tactic
 */
export function getRecommendedFormations(tacticId: string): string[] {
  const tactic = TACTICS.find(t => t.id === tacticId);
  return tactic?.formations || ['4-3-3', '4-4-2', '3-5-2'];
}
