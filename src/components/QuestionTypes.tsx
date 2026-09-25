import React, { useState } from 'react';

// Lightning Round - True/False rapid fire
interface LightningProps {
  question: any;
  answers: boolean[];
  setAnswers: (v: boolean[]) => void;
  submitted: boolean;
}

export function Lightning({ question, answers, setAnswers, submitted }: LightningProps) {
  const currentIndex = answers.length;

  if (currentIndex >= question.questions.length) {
    return (
      <div className="complete-box">
        {currentIndex} / {question.questions.length} questions completed
      </div>
    );
  }

  const currentQuestion = question.questions[currentIndex];

  return (
    <div className="lightning">
      <div className="lightning-head">
        <span>⚡ LIGHTNING ROUND</span>
        <b>
          QUESTION {currentIndex + 1}/{question.questions.length}
        </b>
      </div>

      <div className="lightning-q">
        {currentQuestion.question || currentQuestion}
      </div>

      <div className="tf">
        <button
          disabled={submitted}
          onClick={() => setAnswers([...answers, true])}
        >
          TRUE <span>✓</span>
        </button>
        <button
          disabled={submitted}
          onClick={() => setAnswers([...answers, false])}
        >
          FALSE <span>×</span>
        </button>
      </div>

      <small>
        60 seconds · {question.questions.length} questions · Each correct{' '}
        {question.points_per_correct * question.multiplier} points
      </small>
    </div>
  );
}

// Top 5 - Select 5 items from list
interface Top5Props {
  question: any;
  selected: string[];
  setSelected: (v: string[]) => void;
  submitted: boolean;
}

export function TopFive({ question, selected, setSelected, submitted }: Top5Props) {
  const toggle = (option: string) => {
    if (submitted) return;

    if (selected.includes(option)) {
      setSelected(selected.filter(x => x !== option));
    } else if (selected.length < 5) {
      setSelected([...selected, option]);
    }
  };

  return (
    <div className="top-five">
      <div className="slot-grid">
        {Array.from({ length: 5 }).map((_, i) => (
          <div className={`slot ${selected[i] ? 'filled' : ''}`} key={i}>
            <span>{i + 1}</span>
            {selected[i] || 'Select player'}
          </div>
        ))}
      </div>

      <p className="muted">Select 5 players · Order doesn't matter</p>

      <div className="pick-grid">
        {question.options.map((option: string) => (
          <button
            key={option}
            className={selected.includes(option) ? 'picked' : ''}
            disabled={submitted}
            onClick={() => toggle(option)}
          >
            {option}
            <span>{selected.includes(option) ? '✓' : '+'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Stat Detective - Guess player from revealed stats
interface DetectiveProps {
  question: any;
  guess: string;
  setGuess: (v: string) => void;
  attempts: number;
  setAttempts: (v: number) => void;
  revealed: number;
  setRevealed: (v: number) => void;
  submitted: boolean;
}

export function Detective({
  question,
  guess,
  setGuess,
  attempts,
  setAttempts,
  revealed,
  setRevealed,
  submitted
}: DetectiveProps) {
  const stats = [
    ['NAT', question.stats.nationality],
    ['LGE', question.stats.league],
    ['TEAM', question.stats.team],
    ['POS', question.stats.position],
    ['AGE', question.stats.age],
    ['SHIRT', question.stats.shirt_number]
  ];

  const handleGuess = () => {
    setAttempts(attempts + 1);
    setRevealed(Math.min(6, revealed + 2));
    setGuess('');
  };

  return (
    <div className="detective">
      <div className="stat-grid">
        {stats.map(([key, value], i) => (
          <div className={`stat-card ${i < revealed ? 'shown' : ''}`} key={key}>
            <b>{key}</b>
            <strong>{i < revealed ? String(value) : '?'}</strong>
          </div>
        ))}
      </div>

      <div className="guess-row">
        <input
          value={guess}
          onChange={e => setGuess(e.target.value)}
          disabled={submitted || attempts >= 5}
          placeholder="Type player name…"
        />
        <button
          className="btn btn-primary"
          disabled={!guess || submitted || attempts >= 5}
          onClick={handleGuess}
        >
          Guess
        </button>
      </div>

      <small>
        Attempt {Math.min(attempts + 1, 5)}/5 · Each wrong reveals 2 clues
      </small>
    </div>
  );
}

// Formation Builder - Fill in 11 positions
const formationCoordinates: Record<string, { left: string; top: string }> = {
  GK: { left: '50%', top: '87%' },
  LB: { left: '18%', top: '68%' },
  CB1: { left: '39%', top: '68%' },
  CB2: { left: '61%', top: '68%' },
  CB3: { left: '50%', top: '68%' },
  RB: { left: '82%', top: '68%' },
  LM: { left: '18%', top: '45%' },
  CM1: { left: '35%', top: '45%' },
  CM2: { left: '50%', top: '45%' },
  CM3: { left: '65%', top: '45%' },
  RM: { left: '82%', top: '45%' },
  CDM1: { left: '38%', top: '53%' },
  CDM2: { left: '62%', top: '53%' },
  CAM1: { left: '38%', top: '30%' },
  CAM: { left: '50%', top: '30%' },
  CAM2: { left: '62%', top: '30%' },
  LW: { left: '22%', top: '19%' },
  ST1: { left: '40%', top: '18%' },
  ST: { left: '50%', top: '13%' },
  ST2: { left: '60%', top: '18%' },
  RW: { left: '78%', top: '19%' }
};

interface FormationProps {
  question: any;
  values: Record<string, string>;
  setValues: (v: Record<string, string>) => void;
  selected: string;
  setSelected: (v: string) => void;
  submitted: boolean;
}

export function Formation({
  question,
  values,
  setValues,
  selected,
  setSelected,
  submitted
}: FormationProps) {
  const positions = question.positions as { id: string; label: string }[];

  return (
    <div className="formation">
      <div className="field">
        <div className="field-mark center" />
        {positions.map(p => (
          <button
            className={`position position-${p.id} ${
              selected === p.id ? 'active' : ''
            }`}
            style={formationCoordinates[p.id]}
            key={p.id}
            onClick={() => setSelected(p.id)}
          >
            {p.label}
            <strong>{values[p.id] || '+'}</strong>
          </button>
        ))}
      </div>

      <div className="keyboard">
        {'QWERTYUIOPASDFGHJKLZXCVBNM'.split('').map(key => (
          <button
            key={key}
            disabled={submitted}
            onClick={() =>
              setValues({ ...values, [selected]: (values[selected] || '') + key })
            }
          >
            {key}
          </button>
        ))}
        <button
          className="wide"
          onClick={() => setValues({ ...values, [selected]: '' })}
        >
          ⌫
        </button>
        <button
          className="wide enter"
          onClick={() => {
            const currentIndex = positions.findIndex(x => x.id === selected);
            setSelected(positions[(currentIndex + 1) % positions.length].id);
          }}
        >
          ENTER
        </button>
      </div>
    </div>
  );
}

// Career Path - Sort clubs chronologically
interface CareerProps {
  question: any;
  items: any[];
  setItems: (v: any[]) => void;
  submitted: boolean;
}

export function Career({ question, items, setItems, submitted }: CareerProps) {
  const move = (index: number, direction: number) => {
    if (submitted) return;

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;

    const arr = [...items];
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    setItems(arr);
  };

  return (
    <div className="career">
      <p className="muted">{question.player} · Oldest → Newest</p>

      {items.map((club, i) => (
        <div className="career-item" key={club.name + club.years + i}>
          <span className="number">{i + 1}</span>
          <div>
            <b>{club.name}</b>
            <small>{club.years}</small>
          </div>
          <span className="arrows">
            <button onClick={() => move(i, -1)}>↑</button>
            <button onClick={() => move(i, 1)}>↓</button>
          </span>
        </div>
      ))}
    </div>
  );
}

// Match Maker - Connect players to teams
interface MatcherProps {
  question: any;
  selected: string;
  setSelected: (v: string) => void;
  matches: Record<string, string>;
  setMatches: (v: Record<string, string>) => void;
  submitted: boolean;
}

export function Matcher({
  question,
  selected,
  setSelected,
  matches,
  setMatches,
  submitted
}: MatcherProps) {
  return (
    <div className="matcher">
      <div className="match-cols">
        <div>
          {question.players.map((player: any) => (
            <button
              key={player.name}
              className={selected === player.name ? 'match-card selected' : 'match-card'}
              disabled={submitted}
              onClick={() => setSelected(player.name)}
            >
              <b>{player.name}</b>
              <small>{player.hint}</small>
              {matches[player.name] && <em>→ {matches[player.name]}</em>}
            </button>
          ))}
        </div>

        <div className="match-lines">
          {Object.entries(matches).map(([player]) => (
            <span key={player}>↔</span>
          ))}
        </div>

        <div>
          {question.teams.map((team: any) => (
            <button
              key={team.name}
              className="match-card team-card"
              disabled={submitted || !selected}
              onClick={() => {
                setMatches({ ...matches, [selected]: team.name });
                setSelected('');
              }}
            >
              <b>{team.name}</b>
              <small>{team.hint}</small>
            </button>
          ))}
        </div>
      </div>

      <small>
        {Object.keys(matches).length}/{question.players.length} matches · Select
        player, then team
      </small>
    </div>
  );
}
