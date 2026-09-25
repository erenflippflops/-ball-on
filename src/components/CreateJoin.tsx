import React, { useState } from 'react';
import { useTranslation } from '../i18n';

type Mode = 'solo' | 'team';

interface CreateViewProps {
  onBack: () => void;
  onCreated: (room: any, playerId: string) => void;
}

export function CreateView({ onBack, onCreated }: CreateViewProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<Mode>('solo');
  const [error, setError] = useState('');

  const submit = async () => {
    if (!name.trim()) {
      setError(t('enterName'));
      return;
    }

    try {
      const socket = (window as any).amoSocket;
      const result: any = await new Promise(resolve =>
        socket.emit('quiz_create_room', { nickname: name.trim(), mode }, resolve)
      );

      if (!result.success) {
        setError(result.error || 'Failed to create room');
      } else {
        onCreated(result.room, result.playerId);
      }
    } catch (err) {
      setError('Failed to create room');
    }
  };

  return (
    <FormFrame
      title={t('createTitle')}
      subtitle={t('createSubtitle')}
      onBack={onBack}
    >
      <label>
        {t('playerName')}
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value.slice(0, 20))}
          placeholder={t('playerNamePlaceholder')}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
      </label>

      <span className="field-label">{t('gameMode')}</span>
      <div className="mode-grid">
        <button
          className={mode === 'solo' ? 'mode active' : 'mode'}
          onClick={() => setMode('solo')}
        >
          <span>♙</span>
          <b>{t('soloMode')}</b>
          <small>{t('soloModeDesc')}</small>
        </button>
        <button
          className={mode === 'team' ? 'mode active' : 'mode'}
          onClick={() => setMode('team')}
        >
          <span>♟♟</span>
          <b>{t('teamMode')}</b>
          <small>{t('teamModeDesc')}</small>
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <button className="btn btn-primary full" onClick={submit}>
        {t('createRoom')} <span>→</span>
      </button>
    </FormFrame>
  );
}

interface JoinViewProps {
  onBack: () => void;
  onJoined: (room: any, playerId: string) => void;
}

export function JoinView({ onBack, onJoined }: JoinViewProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    if (!name.trim()) {
      setError(t('enterName'));
      return;
    }
    if (!code.trim()) {
      setError(t('enterRoomCode'));
      return;
    }

    try {
      const socket = (window as any).amoSocket;
      const result: any = await new Promise(resolve =>
        socket.emit(
          'quiz_join_room',
          { roomId: code.toUpperCase(), nickname: name.trim() },
          resolve
        )
      );

      if (!result.success) {
        setError(result.error || t('roomNotFound'));
      } else {
        onJoined(result.room, result.playerId);
      }
    } catch (err) {
      setError(t('roomNotFound'));
    }
  };

  return (
    <FormFrame
      title={t('joinTitle')}
      subtitle={t('joinSubtitle')}
      onBack={onBack}
    >
      <label>
        {t('roomCode')}
        <input
          autoFocus
          className="code-input"
          value={code}
          onChange={e =>
            setCode(
              e.target.value
                .replace(/[^a-z0-9]/gi, '')
                .slice(0, 6)
                .toUpperCase()
            )
          }
          placeholder={t('roomCodePlaceholder')}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
      </label>

      <label>
        {t('playerName')}
        <input
          value={name}
          onChange={e => setName(e.target.value.slice(0, 20))}
          placeholder={t('playerNamePlaceholder')}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
      </label>

      {error && <p className="error">{error}</p>}

      <button className="btn btn-primary full" onClick={submit}>
        {t('joinRoom')} <span>→</span>
      </button>
    </FormFrame>
  );
}

interface FormFrameProps {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: React.ReactNode;
}

function FormFrame({ title, subtitle, onBack, children }: FormFrameProps) {
  const { t } = useTranslation();

  return (
    <section className="form-page page-enter">
      <button className="back" onClick={onBack}>
        ← {t('back')}
      </button>
      <div className="form-card">
        <p className="eyebrow">{t('amoArena')} / LOBBY</p>
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
        {children}
      </div>
    </section>
  );
}
