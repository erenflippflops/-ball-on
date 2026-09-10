import React from 'react';
import type { Player } from './types';

interface MiniFieldProps {
  roster: Player[];
  formation: string;
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

function getPositionMatch(playerPos: string, slotPos: string): number {
  if (playerPos === slotPos) return 3; // Perfect match

  // Position compatibility
  const compatible: Record<string, string[]> = {
    'GK': [],
    'CB': ['CB'],
    'LB': ['LB', 'LWB'],
    'RB': ['RB', 'RWB'],
    'LWB': ['LWB', 'LB'],
    'RWB': ['RWB', 'RB'],
    'DM': ['DM', 'CM'],
    'CM': ['CM', 'DM', 'AM'],
    'AM': ['AM', 'CM'],
    'LM': ['LM', 'LW'],
    'RM': ['RM', 'RW'],
    'LW': ['LW', 'LM', 'ST'],
    'RW': ['RW', 'RM', 'ST'],
    'ST': ['ST', 'LW', 'RW']
  };

  if (compatible[slotPos]?.includes(playerPos)) return 2;
  return 0;
}

function autoAssignRoster(roster: Player[], formation: string): (Player | null)[] {
  const positions = FORMATION_POSITIONS[formation] || FORMATION_POSITIONS['4-3-3'];
  const assigned: (Player | null)[] = new Array(11).fill(null);
  const used = new Set<string>();

  // Sort roster by overall
  const sorted = [...roster].sort((a, b) => b.baseOverall - a.baseOverall);

  // First pass: perfect matches
  positions.forEach((slot, idx) => {
    const perfect = sorted.find(p => !used.has(p.id) && getPositionMatch(p.primaryPosition, slot.pos) === 3);
    if (perfect) {
      assigned[idx] = perfect;
      used.add(perfect.id);
    }
  });

  // Second pass: compatible positions
  positions.forEach((slot, idx) => {
    if (!assigned[idx]) {
      const compatible = sorted.find(p => !used.has(p.id) && getPositionMatch(p.primaryPosition, slot.pos) >= 2);
      if (compatible) {
        assigned[idx] = compatible;
        used.add(compatible.id);
      }
    }
  });

  // Third pass: fill remaining with best available
  positions.forEach((slot, idx) => {
    if (!assigned[idx]) {
      const any = sorted.find(p => !used.has(p.id));
      if (any) {
        assigned[idx] = any;
        used.add(any.id);
      }
    }
  });

  return assigned;
}

export function MiniField({ roster, formation }: MiniFieldProps) {
  const positions = FORMATION_POSITIONS[formation] || FORMATION_POSITIONS['4-3-3'];
  const assigned = autoAssignRoster(roster, formation);

  return (
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
        const player = assigned[idx];
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
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: player ? 'linear-gradient(135deg, #b8ed61 0%, #729187 100%)' : 'rgba(114, 145, 135, 0.3)',
              border: player ? '2px solid #b8ed61' : '2px dashed rgba(114, 145, 135, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '9px',
              fontWeight: 700,
              color: player ? '#0a1a15' : '#729187'
            }}>
              {player ? player.baseOverall : slot.pos}
            </div>
            {player && (
              <div style={{
                fontSize: '8px',
                color: '#b8ed61',
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
  );
}
