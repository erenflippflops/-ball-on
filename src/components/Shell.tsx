import React from 'react';
import { useTranslation } from '../i18n';

interface ShellProps {
  children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  const { t, language, setLanguage } = useTranslation();

  return (
    <main className="app">
      <div className="ambient a1" />
      <div className="ambient a2" />

      <header className="topbar">
        <button
          className="brand"
          onClick={() => window.location.reload()}
          aria-label={t('amoArena') + ' ' + t('back')}
        >
          <span className="brand-mark">A</span>
          <span>{t('amoArena')}</span>
        </button>

        <div className="lang-switcher">
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
          <button
            className={language === 'de' ? 'active' : ''}
            onClick={() => setLanguage('de')}
          >
            DE
          </button>
        </div>

        <span className="live-dot">
          <i /> {t('liveGame')}
        </span>
      </header>

      {children}

      <footer>
        <span>{t('amoArena')}</span>
        <span>{t('tagline')}</span>
      </footer>
    </main>
  );
}
