import React from 'react';

interface MainMenuProps {
  onSelectGame: (game: 'ball-on' | 'amo-arena') => void;
}

export default function MainMenu({ onSelectGame }: MainMenuProps) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Pitch decorations */}
      <div className="pitch-decoration pitch-midline"></div>
      <div className="pitch-decoration pitch-circle"></div>
      <div className="pitch-decoration pitch-center-dot"></div>

      <header className="app-header">
        <div className="app-logo">
          <span className="app-logo-text">BALL-ON</span>
          <span className="app-subtitle">FUTBOL OYUNLARI</span>
        </div>
      </header>

      <section style={{ position: 'relative', padding: '18px 22px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '40px', lineHeight: 1.02, color: 'var(--ink)' }}>
          Arkadaşlarınla sahaya çık.
        </h1>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--muted)' }}>
          İki oyun, tek oda kodu. Boş yerlere bot gelir.
        </p>
      </section>

      <section style={{ position: 'relative', padding: '26px 26px 0', display: 'flex', flexDirection: 'column', gap: '30px' }}>
        <button
          data-testid="landing-draft"
          onClick={() => onSelectGame('ball-on')}
          className="game-card"
          style={{ transform: 'rotate(-1.5deg)' }}
        >
          <div className="game-card-header game-card-header-navy">
            <span className="game-card-title">Draft Manager</span>
            <span className="game-card-badge">11</span>
          </div>
          <div className="game-card-body">
            <span className="game-card-desc">Açık artırmada 11'ini kur, turnuvada kupayı kaldır.</span>
            <div className="game-card-tags">
              <span className="game-card-tag">Açık artırma</span>
              <span className="game-card-tag">2–8 kişi</span>
              <span className="game-card-tag">Eleme turnuvası</span>
            </div>
          </div>
        </button>

        <button
          data-testid="landing-amo"
          onClick={() => window.location.href = '/amo-arena.html'}
          className="game-card"
          style={{ transform: 'rotate(1.2deg)' }}
        >
          <div className="game-card-header game-card-header-orange">
            <span className="game-card-title game-card-title-orange">Amo Arena</span>
          </div>
          <div className="game-card-body">
            <span className="game-card-desc">Futbol bilgini yarıştır: 10 tur, 7 soru tipi.</span>
            <div className="game-card-tags">
              <span className="game-card-tag">Bilgi yarışması</span>
              <span className="game-card-tag">2–6 kişi</span>
            </div>
          </div>
        </button>
      </section>
    </div>
  );
}
