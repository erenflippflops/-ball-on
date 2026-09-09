import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { socketService } from './socketService';
import type { Room, Phase } from './types';

const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

function AdminPanel() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string>('');

  // Fetch rooms periodically
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await fetch(`${API_URL}/admin/rooms`);
        const data = await response.json();
        setRooms(data.rooms || []);
        setError('');
      } catch (err) {
        console.error('Failed to fetch rooms:', err);
        setError('Failed to connect to server');
      }
    };

    fetchRooms();
    const interval = setInterval(fetchRooms, 2000);
    return () => clearInterval(interval);
  }, []);

  // Fetch selected room details
  useEffect(() => {
    if (!selectedRoom) return;

    const fetchRoom = async () => {
      try {
        const response = await fetch(`${API_URL}/admin/room/${selectedRoom}`);
        const data = await response.json();
        setRoom(data.room);
      } catch (err) {
        console.error('Failed to fetch room:', err);
      }
    };

    fetchRoom();
    const interval = setInterval(fetchRoom, 1000);
    return () => clearInterval(interval);
  }, [selectedRoom]);

  const changePhase = async (phase: Phase) => {
    try {
      await fetch(`${API_URL}/admin/room/${selectedRoom}/phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase })
      });
    } catch (err) {
      console.error('Failed to change phase:', err);
    }
  };

  const addBudget = async (teamId: string, amount: number) => {
    try {
      await fetch(`${API_URL}/admin/room/${selectedRoom}/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, amount })
      });
    } catch (err) {
      console.error('Failed to add budget:', err);
    }
  };

  const skipToPlayer = async (index: number) => {
    try {
      await fetch(`${API_URL}/admin/room/${selectedRoom}/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index })
      });
    } catch (err) {
      console.error('Failed to skip:', err);
    }
  };

  const finishAuction = async () => {
    try {
      await fetch(`${API_URL}/admin/room/${selectedRoom}/finish-auction`, {
        method: 'POST'
      });
    } catch (err) {
      console.error('Failed to finish auction:', err);
    }
  };

  const resetRoom = async () => {
    try {
      await fetch(`${API_URL}/admin/room/${selectedRoom}/reset`, {
        method: 'POST'
      });
    } catch (err) {
      console.error('Failed to reset room:', err);
    }
  };

  return (
    <div style={{ padding: '40px', background: '#020617', minHeight: '100vh', color: '#F1F5F9' }}>
      <h1 style={{ fontFamily: 'var(--font-heading)', color: '#84cc16', marginBottom: '30px' }}>
        🔧 BALL ON! Admin Panel
      </h1>

      {error && (
        <div style={{ padding: '15px', background: 'rgba(220, 38, 38, 0.2)', border: '1px solid rgba(220, 38, 38, 0.5)', borderRadius: '8px', marginBottom: '20px', color: '#DC2626' }}>
          {error} - API URL: {API_URL}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '30px' }}>
        {/* Rooms List */}
        <div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Active Rooms ({rooms.length})</h2>
          {rooms.length === 0 && !error && (
            <div style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(132, 204, 22, 0.3)', borderRadius: '8px', textAlign: 'center', opacity: 0.6 }}>
              No active rooms
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rooms.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedRoom(r.id)}
                style={{
                  padding: '15px',
                  background: selectedRoom === r.id ? '#84cc16' : 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(132, 204, 22, 0.3)',
                  borderRadius: '8px',
                  color: selectedRoom === r.id ? '#0F172A' : '#F1F5F9',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: selectedRoom === r.id ? 700 : 400
                }}
              >
                <div style={{ fontSize: '0.9rem', marginBottom: '5px' }}>{r.id}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                  {r.teams.length} players • {r.phase}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Room Controls */}
        <div>
          {room ? (
            <>
              <div style={{ marginBottom: '30px', padding: '20px', background: 'rgba(15, 23, 42, 0.8)', borderRadius: '12px', border: '1px solid rgba(132, 204, 22, 0.3)' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Room: {room.id}</h2>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                  Phase: <strong style={{ color: '#84cc16' }}>{room.phase}</strong> |
                  Players: {room.teams.length} |
                  Competition: {room.competition}
                </div>
              </div>

              {/* Phase Controls */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>⚡ Phase Control</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {(['lobby', 'auction', 'steal', 'trade', 'lineup', 'tactics', 'match', 'result'] as Phase[]).map(phase => (
                    <button
                      key={phase}
                      onClick={() => changePhase(phase)}
                      disabled={room.phase === phase}
                      style={{
                        padding: '12px',
                        background: room.phase === phase ? '#84cc16' : 'rgba(132, 204, 22, 0.1)',
                        border: '1px solid rgba(132, 204, 22, 0.3)',
                        borderRadius: '8px',
                        color: room.phase === phase ? '#0F172A' : '#F1F5F9',
                        cursor: room.phase === phase ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        fontSize: '0.75rem'
                      }}
                    >
                      {phase}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auction Controls */}
              {room.phase === 'auction' && (
                <div style={{ marginBottom: '30px' }}>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>🎯 Auction Control</h3>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <button
                      onClick={finishAuction}
                      style={{
                        padding: '12px 20px',
                        background: '#DC2626',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Finish Current Auction
                    </button>
                    <input
                      type="number"
                      placeholder="Player index"
                      style={{
                        padding: '12px',
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(132, 204, 22, 0.3)',
                        borderRadius: '8px',
                        color: '#F1F5F9',
                        width: '150px'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          skipToPlayer(parseInt((e.target as HTMLInputElement).value));
                        }
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                    Current Player: {room.currentPlayerIndex} / {room.auctionPool.length}
                  </div>
                </div>
              )}

              {/* Teams */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>👥 Teams</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                  {room.teams.map(team => (
                    <div
                      key={team.id}
                      style={{
                        padding: '15px',
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(132, 204, 22, 0.3)',
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: '8px', color: '#84cc16' }}>
                        {team.name}
                      </div>
                      <div style={{ fontSize: '0.85rem', marginBottom: '10px' }}>
                        Budget: <strong>{team.budget} CR</strong> |
                        Roster: {team.roster.length} |
                        Scouts: {team.scouts} |
                        Buff: {team.buff}
                      </div>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          onClick={() => addBudget(team.id, 10)}
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(132, 204, 22, 0.2)',
                            border: '1px solid rgba(132, 204, 22, 0.4)',
                            borderRadius: '6px',
                            color: '#84cc16',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          +10 CR
                        </button>
                        <button
                          onClick={() => addBudget(team.id, 50)}
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(132, 204, 22, 0.2)',
                            border: '1px solid rgba(132, 204, 22, 0.4)',
                            borderRadius: '6px',
                            color: '#84cc16',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          +50 CR
                        </button>
                        <button
                          onClick={() => addBudget(team.id, -team.budget)}
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(220, 38, 38, 0.2)',
                            border: '1px solid rgba(220, 38, 38, 0.4)',
                            borderRadius: '6px',
                            color: '#DC2626',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Danger Zone */}
              <div style={{ padding: '20px', background: 'rgba(220, 38, 38, 0.1)', border: '1px solid rgba(220, 38, 38, 0.3)', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#DC2626' }}>⚠️ Danger Zone</h3>
                <button
                  onClick={resetRoom}
                  style={{
                    padding: '12px 20px',
                    background: '#DC2626',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Reset Room
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '100px', opacity: 0.5 }}>
              Select a room to manage
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<AdminPanel />);
