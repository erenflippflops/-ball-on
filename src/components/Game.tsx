import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import type { Question, Room } from '../types/quiz';
import { Lightning, TopFive, Detective, Formation, Career, Matcher } from './QuestionTypes';

interface GameProps {
  room: Room;
  playerId: string;
  onError: (msg: string) => void;
}

export function Game({ room, playerId, onError }: GameProps) {
  const { t } = useTranslation();
  const question = room.question!;
  const [submitted, setSubmitted] = useState(false);
  const [seconds, setSeconds] = useState(question.time_limit);
  const [answer, setAnswer] = useState<any>(null);

  // Question-specific state
  const [lightning, setLightning] = useState<boolean[]>([]);
  const [top5, setTop5] = useState<string[]>([]);
  const [detect, setDetect] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [formation, setFormation] = useState<Record<string, string>>({});
  const [selectedPos, setSelectedPos] = useState('GK');
  const [career, setCareer] = useState<any[]>(() => question.clubs ? [...question.clubs].sort(() => Math.random() - 0.5) : []);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [selectedPlayer, setSelectedPlayer] = useState('');

  const finish = async (value: any) => {
    if (submitted) return;
    setSubmitted(true);

    try {
      const socket = (window as any).amoSocket;
      const result: any = await new Promise(resolve =>
        socket.emit(
          'quiz_submit_answer',
          { roomId: room.id, playerId, answer: value },
          resolve
        )
      );

      if (!result.success) {
        setSubmitted(false);
        onError(result.error || t('answerFailed'));
      }
    } catch (err) {
      setSubmitted(false);
      onError(t('answerFailed'));
    }
  };

  // Reset state on new question
  useEffect(() => {
    setSeconds(question.time_limit);
    setSubmitted(false);
    setAnswer(null);
    setLightning([]);
    setTop5([]);
    setDetect('');
    setAttempts(0);
    setRevealed(0);
    setFormation({});
    setSelectedPos('GK');
    setCareer(question.clubs ? [...question.clubs].sort(() => Math.random() - 0.5) : []);
    setMatches({});
    setSelectedPlayer('');
  }, [question.id]);

  // Countdown timer
  useEffect(() => {
    if (submitted) return;

    const timer = setInterval(() => {
      setSeconds((s: number) => {
        if (s <= 1) {
          clearInterval(timer);
          finish(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [submitted, question.id]);

  const progress = Math.max(0, (seconds / question.time_limit) * 100);
  const typeLabel = getQuestionTypeLabel(question.type, t);

  return (
    <section className="game page-enter">
      <div className="game-top">
        <div>
          <span className="round-label">
            {t('round')} {room.currentRound}/{room.totalRounds}
          </span>
          <div className="progress">
            <i
              style={{
                width: `${((room.currentRound - 1) / room.totalRounds) * 100}%`
              }}
            />
          </div>
        </div>
        <div className={seconds < 10 ? 'timer danger' : 'timer'}>
          <span>⏱</span>
          {seconds}s
        </div>
      </div>

      <div className="game-grid">
        <div className="question-main">
          <div className="question-meta">
            <span className="type-chip">{typeLabel}</span>
            <span>
              {room.answered?.length || 0}/{room.players.length} {t('answered')}
            </span>
          </div>

          <h2>{question.question}</h2>

          <QuestionComponent
            question={question}
            answer={answer}
            setAnswer={setAnswer}
            lightning={lightning}
            setLightning={setLightning}
            top5={top5}
            setTop5={setTop5}
            detect={detect}
            setDetect={setDetect}
            attempts={attempts}
            setAttempts={setAttempts}
            revealed={revealed}
            setRevealed={setRevealed}
            formation={formation}
            setFormation={setFormation}
            selectedPos={selectedPos}
            setSelectedPos={setSelectedPos}
            career={career}
            setCareer={setCareer}
            matches={matches}
            setMatches={setMatches}
            selectedPlayer={selectedPlayer}
            setSelectedPlayer={setSelectedPlayer}
            submitted={submitted}
          />

          <button
            className="btn btn-primary submit"
            disabled={submitted || !isAnswerValid(question.type, answer, top5)}
            onClick={() => {
              const finalAnswer = getFinalAnswer(question.type, answer, lightning, top5, detect, formation, career, matches);
              finish(finalAnswer);
            }}
          >
            {submitted ? `${t('answerSubmitted')} ✓` : `${t('submitAnswer')} →`}
          </button>
        </div>

        <aside className="game-side">
          <div className="side-title">{t('gameStatus')}</div>
          <div className="mini-players">
            {room.players.map(p => (
              <div key={p.id} className="mini-player">
                <i
                  className={
                    room.answered?.some(a => a.playerId === p.id) ? 'done' : ''
                  }
                />
                <span>
                  {p.avatar} {p.nickname}
                </span>
                <b>{p.score}</b>
              </div>
            ))}
          </div>

          <div className="score-note">
            <span>{t('scoring')}</span>
            <strong>{t('scoringDesc')}</strong>
            <small>{t('scoringDetails')}</small>
          </div>
        </aside>
      </div>

      <div className="timer-line">
        <i style={{ width: `${progress}%` }} />
      </div>
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

function isAnswerValid(type: string, answer: any, top5: string[]): boolean {
  if (type === 'multiple_choice') return !!answer;
  if (type === 'top_5') return top5.length === 5;
  return true;
}

function getFinalAnswer(
  type: string,
  answer: any,
  lightning: boolean[],
  top5: string[],
  detect: string,
  formation: Record<string, string>,
  career: any[],
  matches: Record<string, string>
): any {
  switch (type) {
    case 'multiple_choice': return answer;
    case 'lightning': return lightning;
    case 'top_5': return top5;
    case 'stat_detective': return detect;
    case 'formation_builder': return formation;
    case 'career_path': return career;
    case 'match_maker': return matches;
    default: return answer;
  }
}

// Question type router
function QuestionComponent(props: any) {
  const { question, submitted } = props;

  switch (question.type) {
    case 'multiple_choice':
      return <MultipleChoice question={question} answer={props.answer} setAnswer={props.setAnswer} submitted={submitted} />;
    case 'lightning':
      return <Lightning question={question} answers={props.lightning} setAnswers={props.setLightning} submitted={submitted} />;
    case 'top_5':
      return <TopFive question={question} selected={props.top5} setSelected={props.setTop5} submitted={submitted} />;
    case 'stat_detective':
      return <Detective question={question} guess={props.detect} setGuess={props.setDetect} attempts={props.attempts} setAttempts={props.setAttempts} revealed={props.revealed} setRevealed={props.setRevealed} submitted={submitted} />;
    case 'formation_builder':
      return <Formation question={question} values={props.formation} setValues={props.setFormation} selected={props.selectedPos} setSelected={props.setSelectedPos} submitted={submitted} />;
    case 'career_path':
      return <Career question={question} items={props.career} setItems={props.setCareer} submitted={submitted} />;
    case 'match_maker':
      return <Matcher question={question} selected={props.selectedPlayer} setSelected={props.setSelectedPlayer} matches={props.matches} setMatches={props.setMatches} submitted={submitted} />;
    default:
      return <div className="placeholder">Question type: {question.type}</div>;
  }
}

function MultipleChoice({ question, answer, setAnswer, submitted }: any) {
  return (
    <div className="options">
      {question.options.map((option: string, i: number) => (
        <button
          key={option}
          className={`option ${answer === option ? 'selected' : ''}`}
          disabled={submitted}
          onClick={() => setAnswer(option)}
        >
          <b>{String.fromCharCode(65 + i)}</b>
          <span>{option}</span>
        </button>
      ))}
    </div>
  );
}
