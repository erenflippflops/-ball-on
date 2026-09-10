import React, { useState } from 'react';
import type { Player, Position } from './types';
import { canPlayInPosition, getPositionPenalty } from './positionCompatibility';

interface MiniFieldProps {
  roster: Player[];
  formation: string;
  lineup?: Record<string, string>; // slot -> playerId
  onLineupChange?: (lineup: Record<string, string>) => void;
  editable?: boolean;
}

const FORMATION_POSITIONS: Record<string, { x: number; y: number; pos: string }[]> = {
  '4-3-3': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 15, y: 25, pos: 'LB' },
    { x: 35, y: 25, pos: 'CB' },
    { x: 65, y: 25, pos: 'CB' },
    { x: 85, y: 25, pos: 'RB' },
    { x: 25, y: 50, pos: 'CM' },
    { x: 50, y: 50, pos: 'CM' },
    { x: 75, y: 50, pos: 'CM' },
    { x: 15, y: 80, pos: 'LW' },
    { x: 50, y: 85, pos: 'ST' },
    { x: 85, y: 80, pos: 'RW' }
  ],
  '4-4-2': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 15, y: 25, pos: 'LB' },
    { x: 35, y: 25, pos: 'CB' },
    { x: 65, y: 25, pos: 'CB' },
    { x: 85, y: 25, pos: 'RB' },
    { x: 15, y: 50, pos: 'LM' },
    { x: 38, y: 50, pos: 'CM' },
    { x: 62, y: 50, pos: 'CM' },
    { x: 85, y: 50, pos: 'RM' },
    { x: 35, y: 80, pos: 'ST' },
    { x: 65, y: 80, pos: 'ST' }
  ],
  '3-5-2': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 25, y: 25, pos: 'CB' },
    { x: 50, y: 25, pos: 'CB' },
    { x: 75, y: 25, pos: 'CB' },
    { x: 10, y: 50, pos: 'LM' },
    { x: 30, y: 50, pos: 'CM' },
    { x: 50, y: 50, pos: 'CM' },
    { x: 70, y: 50, pos: 'CM' },
    { x: 90, y: 50, pos: 'RM' },
    { x: 35, y: 80, pos: 'ST' },
    { x: 65, y: 80, pos: 'ST' }
  ],
  '4-2-3-1': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 15, y: 25, pos: 'LB' },
    { x: 35, y: 25, pos: 'CB' },
    { x: 65, y: 25, pos: 'CB' },
    { x: 85, y: 25, pos: 'RB' },
    { x: 35, y: 45, pos: 'DM' },
    { x: 65, y: 45, pos: 'DM' },
    { x: 15, y: 65, pos: 'LW' },
    { x: 50, y: 65, pos: 'AM' },
    { x: 85, y: 65, pos: 'RW' },
    { x: 50, y: 85, pos: 'ST' }
  ],
  '3-4-3': [
    { x: 50, y: 5, pos: 'GK' },
    { x: 25, y: 25, pos: 'CB' },
    { x: 50, y: 25, pos: 'CB' },
    { x: 75, y: 25, pos: 'CB' },
    { x: 15, y: 50, pos: 'LM' },
    { x: 40, y: 50, pos: 'CM' },
    { x: 60, y: 50, pos: 'CM' },
    { x: 85, y: 50, pos: 'RM' },
    { x: 15, y: 80, pos: 'LW' },
    { x: 50, y: 85, pos: 'ST' },
    { x: 85, y: 80, pos: 'RW' }
  ]
};

function getPositionMatch(playerPrimary: Position, playerSecondary: Position[], slotPos: Position): number {
  if (playerPrimary === slotPos) return 3; // Perfect match
  if (playerSecondary.includes(slotPos)) return 2; // Secondary position

  // Check if can play using new compatibility system
  if (canPlayInPosition(playerPrimary, playerSecondary, slotPos)) {
    const penalty = getPositionPenalty(playerPrimary, playerSecondary, slotPos);
    if (penalty <= 5) return 1; // Compatible
  }

  return 0; // Not compatible
}

function autoAssignRoster(roster: Player[], formation: string): Record<string, string> {
  const positions = FORMATION_POSITIONS[formation] || FORMATION_POSITIONS['4-3-3'];
  const lineup: Record<string, string> = {};
  const used = new Set<string>();

  // Sort roster by overall
  const sorted = [...roster].sort((a, b) => b.baseOverall - a.baseOverall);

  // First pass: perfect matches
  positions.forEach((slot, idx) => {
    const slotKey = `slot-${idx}`;
    const perfect = sorted.find(p => !used.has(p.id) && getPositionMatch(p.primaryPosition, p.secondaryPositions, slot.pos as Position) === 3);
    if (perfect) {
      lineup[slotKey] = perfect.id;
      used.add(perfect.id);
    }
  });

  // Second pass: secondary positions
  positions.forEach((slot, idx) => {
    const slotKey = `slot-${idx}`;
    if (!lineup[slotKey]) {
      const secondary = sorted.find(p => !used.has(p.id) && getPositionMatch(p.primaryPosition, p.secondaryPositions, slot.pos as Position) === 2);
      if (secondary) {
        lineup[slotKey] = secondary.id;
        used.add(secondary.id);
      }
    }
  });

  // Third pass: compatible positions
  positions.forEach((slot, idx) => {
    const slotKey = `slot-${idx}`;
    if (!lineup[slotKey]) {
      const compatible = sorted.find(p => !used.has(p.id) && getPositionMatch(p.primaryPosition, p.secondaryPositions, slot.pos as Position) >= 1);
      if (compatible) {
        lineup[slotKey] = compatible.id;
        used.add(compatible.id);
      }
    }
  });

  return lineup;
}

export function MiniField({ roster, formation, lineup, onLineupChange, editable = false }: MiniFieldProps) {
  const positions = FORMATION_POSITIONS[formation] || FORMATION_POSITIONS['4-3-3'];
  const [draggedPlayer, setDraggedPlayer] = useState<string | null>(null);
  const [draggedFrom, setDraggedFrom] = useState<string | null>(null);

  // Use provided lineup or auto-assign
  const currentLineup = lineup || autoAssignRoster(roster, formation);

  // Get players in lineup
  const playersInLineup = new Set(Object.values(currentLineup));

  // Get bench players (not in lineup)
  const benchPlayers = roster.filter(p => !playersInLineup.has(p.id));

  const handleDragStart = (playerId: string, from: string) => {
    if (!editable) return;
    setDraggedPlayer(playerId);
    setDraggedFrom(from);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!editable) return;
    e.preventDefault();
  };

  const handleDrop = (targetSlot: string, targetPosition: Position) => {
    if (!editable || !draggedPlayer || !onLineupChange) return;

    const player = roster.find(p => p.id === draggedPlayer);
    if (!player) return;

    // Check if player can play in this position
    if (!canPlayInPosition(player.primaryPosition, player.secondaryPositions, targetPosition)) {
      alert(`${player.name} bu pozisyonda oynayamaz! (${player.primaryPosition} → ${targetPosition})`);
      setDraggedPlayer(null);
      setDraggedFrom(null);
      return;
    }

    // Create new lineup
    const newLineup = { ...currentLineup };

    // If swapping with another player
    const targetPlayerId = newLineup[targetSlot];

    if (draggedFrom?.startsWith('slot-')) {
      // Moving from lineup slot
      if (targetPlayerId) {
        // Swap players
        newLineup[draggedFrom] = targetPlayerId;
        newLineup[targetSlot] = draggedPlayer;
      } else {
        // Move to empty slot
        delete newLineup[draggedFrom];
        newLineup[targetSlot] = draggedPlayer;
      }
    } else {
      // Moving from bench
      if (targetPlayerId) {
        // Replace player in slot
        newLineup[targetSlot] = draggedPlayer;
      } else {
        // Add to empty slot
        newLineup[targetSlot] = draggedPlayer;
      }
    }

    onLineupChange(newLineup);
    setDraggedPlayer(null);
    setDraggedFrom(null);
  };

  const handleDropToBench = () => {
    if (!editable || !draggedPlayer || !draggedFrom || !onLineupChange) return;

    if (draggedFrom.startsWith('slot-')) {
      // Remove player from lineup
      const newLineup = { ...currentLineup };
      delete newLineup[draggedFrom];
      onLineupChange(newLineup);
    }

    setDraggedPlayer(null);
    setDraggedFrom(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Field */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '3 / 4',
        background: 'linear-gradient(180deg, rgba(17, 44, 36, 0.8) 0%, rgba(7, 23, 19, 0.9) 100%)',
        borderRadius: '8px',
        border: '2px solid rgba(26, 51, 41, 0.6)',
        overflow: 'hidden'
      }}>
        {/* Field lines */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }}>
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#b8ed61" strokeWidth="1" />
          <circle cx="50%" cy="50%" r="15%" fill="none" stroke="#b8ed61" strokeWidth="1" />
          <rect x="35%" y="0" width="30%" height="15%" fill="none" stroke="#b8ed61" strokeWidth="1" />
          <rect x="35%" y="85%" width="30%" height="15%" fill="none" stroke="#b8ed61" strokeWidth="1" />
        </svg>

        {/* Players */}
        {positions.map((slot, idx) => {
          const slotKey = `slot-${idx}`;
          const playerId = currentLineup[slotKey];
          const player = playerId ? roster.find(p => p.id === playerId) : null;
          const slotPosition = slot.pos as Position;

          // Check position compatibility and get penalty
          let penaltyText = '';
          let isOutOfPosition = false;
          if (player) {
            const penalty = getPositionPenalty(player.primaryPosition, player.secondaryPositions, slotPosition);
            if (penalty > 0) {
              penaltyText = `-${penalty}`;
              isOutOfPosition = true;
            }
          }

          return (
            <div
              key={idx}
              style={{
                position: 'absolute',
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px'
              }}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(slotKey, slotPosition)}
            >
              <div
                draggable={editable && !!player}
                onDragStart={() => handleDragStart(player?.id || '', slotKey)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: player
                    ? isOutOfPosition
                      ? 'linear-gradient(135deg, #f59e0b 0%, #dc2626 100%)'
                      : 'linear-gradient(135deg, #b8ed61 0%, #729187 100%)'
                    : 'rgba(114, 145, 135, 0.3)',
                  border: player ? '2px solid #b8ed61' : '2px dashed rgba(114, 145, 135, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: player ? '#0a1a15' : '#729187',
                  cursor: editable && player ? 'grab' : 'default',
                  position: 'relative'
                }}
              >
                {player ? player.baseOverall : slot.pos}
                {penaltyText && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    fontSize: '8px',
                    fontWeight: 700,
                    color: '#dc2626',
                    background: '#fef3c7',
                    borderRadius: '50%',
                    width: '14px',
                    height: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #f59e0b'
                  }}>
                    {penaltyText}
                  </span>
                )}
              </div>
              {player && (
                <div style={{
                  fontSize: '8px',
                  color: isOutOfPosition ? '#f59e0b' : '#b8ed61',
                  fontWeight: 600,
                  textAlign: 'center',
                  maxWidth: '50px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                }}>
                  {player.name.split(' ').pop()}
                </div>
              )}
            </div>
          );
        })}

        {/* Formation label */}
        <div style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          fontSize: '10px',
          fontWeight: 700,
          color: 'rgba(184, 237, 97, 0.5)',
          textTransform: 'uppercase'
        }}>
          {formation}
        </div>
      </div>

      {/* Bench (substitutes) */}
      {editable && benchPlayers.length > 0 && (
        <div
          style={{
            background: 'rgba(10, 26, 28, 0.6)',
            border: '1px solid rgba(132, 204, 22, 0.3)',
            borderRadius: '6px',
            padding: '10px'
          }}
          onDragOver={handleDragOver}
          onDrop={handleDropToBench}
        >
          <h4 style={{
            margin: '0 0 8px 0',
            fontSize: '12px',
            color: '#94a3b8',
            fontWeight: 600
          }}>
            Yedekler ({benchPlayers.length})
          </h4>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px'
          }}>
            {benchPlayers.map(player => (
              <div
                key={player.id}
                draggable
                onDragStart={() => handleDragStart(player.id, 'bench')}
                style={{
                  background: 'rgba(17, 44, 36, 0.8)',
                  border: '1px solid rgba(132, 204, 22, 0.3)',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'grab',
                  fontSize: '11px',
                  color: '#f1f5f9'
                }}
              >
                <span style={{
                  background: 'linear-gradient(135deg, #b8ed61 0%, #729187 100%)',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: '#0a1a15'
                }}>
                  {player.baseOverall}
                </span>
                <span style={{ fontWeight: 600 }}>
                  {player.name.split(' ').pop()}
                </span>
                <span style={{
                  fontSize: '9px',
                  color: '#84cc16',
                  fontWeight: 600
                }}>
                  {player.primaryPosition}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
