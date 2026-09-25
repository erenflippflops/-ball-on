import React from 'react';
import { useTranslation } from '../i18n';

interface MenuProps {
  onCreate: () => void;
  onJoin: () => void;
  error: string;
}

export function Menu({ onCreate, onJoin, error }: MenuProps) {
  const { t } = useTranslation();

  return (
    <section className="menu page-enter">
      <div className="menu-copy">
        <p className="eyebrow">REAL-TIME FOOTBALL TRIVIA</p>
        <h1>
          {t('menuTitle')}
          <br />
          <em>{t('menuSubtitle')}</em>
        </h1>
        <p className="lede">{t('menuDescription')}</p>

        <div className="action-row">
          <button className="btn btn-primary" onClick={onCreate}>
            {t('createRoom')} <span>→</span>
          </button>
          <button className="btn btn-ghost" onClick={onJoin}>
            {t('joinRoom')} <span>↗</span>
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="quick-stats">
          <span><b>10</b> {t('round').toUpperCase()}</span>
          <span><b>7</b> TYPES</span>
          <span><b>6</b> {t('players').toUpperCase()}</span>
        </div>
      </div>

      <div className="pitch-hero">
        <div className="pitch-lines" />
        <div className="pitch-center">
          <div className="center-circle" />
          <div className="center-dot" />
        </div>
        <div className="pitch-box top" />
        <div className="pitch-box bottom" />
        <span className="pitch-label p1">MCQ</span>
        <span className="pitch-label p2">TOP 5</span>
        <span className="pitch-label p3">MATCH</span>
        <span className="pitch-label p4">FORMATION</span>
        <div className="hero-ball">⚽</div>
        <div className="tactic-note">
          <span className="live-dot">
            <i /> {t('gameStatus')}
          </span>
          <strong>
            {t('scoringDesc')}
          </strong>
        </div>
      </div>
    </section>
  );
}
