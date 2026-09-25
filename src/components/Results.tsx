import React from 'react';
import { useTranslation } from '../i18n';

interface RoundResultProps {
  room: any;
  result: any;
  playerId: string;
  onNext: () => void;
  error: string;
}

export function RoundResult({ room, result, playerId, onNext, error }: RoundResultProps) {
  const { t } = useTranslation();
  const isHost = room.hostId === playerId;

  return (
    <section className="results page-enter">
      <div className="result-header">
        <div>
          <p className="eyebrow">
            {t('round')} {result.round} {t('roundComplete')}
          </p>
          <h2>{t('roundSummary')}</h2>
        </div>
        <span className="correct-pill">✓ {t('answerKey')}</span>
      </div>

      <div className="recap">
        <span>{getQuestionTypeLabel(result.question.type, t)}</span>
        <p>{result.question.question}</p>
      </div>

      <div className="ranking">
        {result.rankings.map((p: any, i: number) => {
          const player = room.players.find((x: any) => x.id === p.id);
          return (
            <div className={`rank-row rank-${i}`} key={p.id}>
              <span className="rank-num">{i + 1}</span>
              <span className="avatar">{player?.avatar}</span>
              <b>{p.name}</b>
              <span className="rank-change">{p.roundScore > 0 ? '↑' : '—'}</span>
              <span className="round-points">+{p.roundScore}</span>
              <strong>{p.score}</strong>
            </div>
          );
        })}
      </div>

      {isHost ? (
        <button className="btn btn-primary next" onClick={onNext}>
          {result.round === room.totalRounds ? t('finalResults') : t('nextRound')} →
        </button>
      ) : (
        <p className="waiting">
          <i /> {t('waitingForHost')}
        </p>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}

interface FinalResultsProps {
  result: any;
  onReplay: () => void;
}

export function FinalResults({ result, onReplay }: FinalResultsProps) {
  const { t } = useTranslation();
  const ranks = result.finalRankings || [];

  return (
    <section className="results final page-enter">
      <p className="eyebrow">{t('amoArena')} / FINAL</p>
      <h2>
        {t('gameOver')}
        <br />
        <em>{t('finalRanking')}</em>
      </h2>

      <div className="podium">
        {ranks.slice(0, 3).map((p: any, i: number) => (
          <div className={`podium-item p-${i}`} key={p.id}>
            <span>{['🥇', '🥈', '🥉'][i]}</span>
            <b>{p.name}</b>
            <strong>{p.score}</strong>
            <small>{t('points')}</small>
          </div>
        ))}
      </div>

      {ranks.length > 3 && (
        <div className="final-list">
          {ranks.slice(3).map((p: any, i: number) => (
            <div key={p.id}>
              <span>{i + 4}</span>
              <b>{p.name}</b>
              <strong>{p.score}</strong>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-primary next" onClick={onReplay}>
        {t('playAgain')} ↺
      </button>
    </section>
  );
}

function getQuestionTypeLabel(type: string, t: any): string {
  const map: Record<string, string> = {
    multiple_choice: t('multipleChoice'),
    lightning: t('lightning'),
    top_5: t('top5'),
    stat_detective: t('statDetective'),
    formation_builder: t('formationBuilder'),
    career_path: t('careerPath'),
    match_maker: t('matchMaker')
  };
  return map[type] || type;
}
