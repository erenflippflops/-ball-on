import React from 'react';
import { useTranslation } from '../i18n';

const AVATARS = ['🏆', '⭐', '🎯', '🎨', '🚀', '⚡'];

interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  team?: 'A' | 'B';
  avatar: string;
  score: number;
  streak: number;
  connected: boolean;
}

interface Room {
  id: string;
  mode: 'solo' | 'team';
  hostId: string;
  players: Player[];
  status: string;
  currentRound: number;
  totalRounds: number;
}

interface LobbyProps {
  room: Room;
  playerId: string;
  onBack: () => void;
  onStart: () => void;
  error: string;
}

export function Lobby({ room, playerId, onBack, onStart, error }: LobbyProps) {
  const { t } = useTranslation();
  const isHost = room.hostId === playerId;

  return (
    <section className="lobby page-enter">
      <div className="lobby-head">
        <div>
          <p className="eyebrow">{t('amoArena')} / LOBBY</p>
          <h2>{t('lobbyTitle')}</h2>
        </div>
        <button className="back" onClick={onBack}>
          ← {t('exit')}
        </button>
      </div>

      <div className="lobby-layout">
        <div className="room-code-panel">
          <span>{t('roomCode')}</span>
          <strong>{room.id}</strong>
          <small>{t('shareCode')}</small>
          <div className="mode-badge">
            {room.mode === 'team' ? `♟ ${t('teamMode').toUpperCase()}` : `♙ ${t('soloMode').toUpperCase()}`}
          </div>
        </div>

        <div className="players-panel">
          <div className="panel-head">
            <span>{t('players')}</span>
            <b>{room.players.length}/6</b>
          </div>

          <div className="player-list">
            {room.players.map((p, i) => (
              <div className="player-row" key={p.id}>
                <span className="avatar">{p.avatar || AVATARS[i]}</span>
                <span className="player-name">
                  {p.nickname}
                  {p.id === playerId && <small> {t('you')}</small>}
                </span>
                {p.isHost && <span className="host-tag">{t('host')}</span>}
                {p.team && (
                  <span className={`team team-${p.team}`}>
                    {t(`team${p.team}` as any)}
                  </span>
                )}
              </div>
            ))}

            {Array.from({ length: 6 - room.players.length }).map((_, i) => (
              <div className="player-row empty" key={`empty-${i}`}>
                <span className="avatar">·</span>
                <span>{t('waitingForPlayers')}</span>
              </div>
            ))}
          </div>

          {isHost ? (
            <button
              className="btn btn-primary full"
              disabled={room.players.length < 2}
              onClick={onStart}
            >
              {room.players.length < 2
                ? t('minPlayersRequired')
                : `${t('startGame')} →`}
            </button>
          ) : (
            <p className="waiting">
              <i /> {t('waitingForHost')}
            </p>
          )}

          {error && <p className="error">{error}</p>}
        </div>
      </div>
    </section>
  );
}
