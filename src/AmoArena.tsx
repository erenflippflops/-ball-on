import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io, Socket } from 'socket.io-client';
import { I18nProvider } from './i18n';
import { Shell } from './components/Shell';
import { Menu } from './components/Menu';
import { CreateView, JoinView } from './components/CreateJoin';
import { Lobby } from './components/Lobby';
import { Game } from './components/Game';
import { RoundResult, FinalResults } from './components/Results';
import './amo-style.css';
import './formation.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://127.0.0.1:3001';

type View = 'menu' | 'create' | 'join' | 'lobby' | 'game' | 'round' | 'final';

function AmoArenaApp() {
  const [view, setView] = useState<View>('menu');
  const [room, setRoom] = useState<any>(null);
  const [playerId, setPlayerId] = useState('');
  const [roundResult, setRoundResult] = useState<any>(null);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Initialize socket
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    (window as any).amoSocket = socket;

    // Socket event handlers
    const handlers = {
      quiz_room_updated: (r: any) => setRoom({ ...r }),
      quiz_player_answered: (payload: { playerId: string }) => {
        setRoom((r: any) => {
          if (!r || r.answered.some((a: any) => a.playerId === payload.playerId)) {
            return r;
          }
          return { ...r, answered: [...r.answered, { playerId: payload.playerId }] };
        });
      },
      quiz_game_started: (p: any) => {
        setRoom((r: any) => (r ? { ...r, ...p, status: 'playing' } : r));
        setView('game');
      },
      quiz_round_result: (p: any) => {
        setRoundResult(p);
        setView('round');
        setRoom((r: any) => (r ? { ...r, status: 'results' } : r));
      },
      quiz_game_finished: (p: any) => {
        setFinalResult(p);
        setView('final');
      },
      quiz_host_disconnected: () => {
        setError('Host disconnected; room closed.');
        setView('menu');
        setRoom(null);
      }
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.keys(handlers).forEach(event => socket.off(event));
      socket.disconnect();
    };
  }, []);

  const goMenu = () => {
    setView('menu');
    setRoom(null);
    setRoundResult(null);
    setFinalResult(null);
    setError('');
  };

  const handleStart = async () => {
    if (!room) return;
    try {
      const socket = (window as any).amoSocket;
      const result: any = await new Promise(resolve =>
        socket.emit('quiz_start_game', { roomId: room.id, playerId }, resolve)
      );
      if (!result.success) {
        setError(result.error || 'Failed to start game');
      }
    } catch (err) {
      setError('Failed to start game');
    }
  };

  // Render based on view
  if (view === 'menu') {
    return <Menu onCreate={() => { setError(''); setView('create'); }} onJoin={() => { setError(''); setView('join'); }} error={error} />;
  }

  if (view === 'create') {
    return <CreateView onBack={goMenu} onCreated={(r, id) => { setRoom(r); setPlayerId(id); setView('lobby'); }} />;
  }

  if (view === 'join') {
    return <JoinView onBack={goMenu} onJoined={(r, id) => { setRoom(r); setPlayerId(id); setView('lobby'); }} />;
  }

  if (view === 'lobby' && room) {
    return <Lobby room={room} playerId={playerId} onBack={goMenu} onStart={handleStart} error={error} />;
  }

  if (view === 'game' && room?.question) {
    return <Game room={room} playerId={playerId} onError={setError} />;
  }

  if (view === 'round' && room && roundResult) {
    return (
      <RoundResult
        room={room}
        result={roundResult}
        playerId={playerId}
        onNext={async () => {
          try {
            const socket = (window as any).amoSocket;
            const result: any = await new Promise(resolve =>
              socket.emit('quiz_next_round', { roomId: room.id, playerId }, resolve)
            );
            if (!result.success) {
              setError(result.error || 'Failed to start next round');
            } else if (result.finished) {
              setFinalResult(result);
              setView('final');
            }
          } catch (err) {
            setError('Failed to start next round');
          }
        }}
        error={error}
      />
    );
  }

  if (view === 'final' && room && finalResult) {
    return <FinalResults result={finalResult} onReplay={goMenu} />;
  }

  return <Menu onCreate={() => setView('create')} onJoin={() => setView('join')} error={error} />;
}

function App() {
  return (
    <I18nProvider>
      <Shell>
        <AmoArenaApp />
      </Shell>
    </I18nProvider>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}

export default App;
