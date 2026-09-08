import type { Team, MatchResult, MatchEvent } from '../src/types';

interface MatchConfig {
  team1: Team;
  team2: Team;
  seed?: number;
}

// Seeded random number generator
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  range(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

export function simulateMatch(config: MatchConfig): MatchResult {
  const { team1, team2, seed = Date.now() } = config;
  const rng = new SeededRandom(seed);

  // Calculate team strengths
  const team1Strength = calculateTeamStrength(team1);
  const team2Strength = calculateTeamStrength(team2);

  // Chemistry and tactics bonus
  const team1Bonus = calculateBonus(team1);
  const team2Bonus = calculateBonus(team2);

  const adjustedStrength1 = team1Strength + team1Bonus;
  const adjustedStrength2 = team2Strength + team2Bonus;

  // Simulate match events
  const events: MatchEvent[] = [];
  let homeScore = 0;
  let awayScore = 0;

  // Generate match events
  const totalEvents = rng.range(8, 15);

  for (let i = 0; i < totalEvents; i++) {
    const minute = rng.range(1, 90);
    const eventType = rng.next();

    if (eventType < 0.3) {
      // Goal attempt
      const scorer = rng.next() < (adjustedStrength1 / (adjustedStrength1 + adjustedStrength2)) ? 'home' : 'away';

      if (rng.next() < 0.35) {
        // Goal scored
        if (scorer === 'home') {
          homeScore++;
          events.push({
            minute,
            type: 'goal',
            team: 'home',
            description: `⚽ Gol! ${getRandomPlayer(team1, rng)} müthiş bir vuruşla ağları havalandırdı!`
          });
        } else {
          awayScore++;
          events.push({
            minute,
            type: 'goal',
            team: 'away',
            description: `⚽ Gol! ${getRandomPlayer(team2, rng)} defansı yararak topu ağlara gönderdi!`
          });
        }
      } else {
        // Chance missed
        events.push({
          minute,
          type: 'chance',
          team: scorer,
          description: `🎯 ${scorer === 'home' ? getRandomPlayer(team1, rng) : getRandomPlayer(team2, rng)} büyük fırsatı kaçırdı!`
        });
      }
    } else if (eventType < 0.5) {
      // Yellow card
      const team = rng.next() < 0.5 ? 'home' : 'away';
      events.push({
        minute,
        type: 'yellow',
        team,
        description: `🟨 Sert faul! ${team === 'home' ? getRandomPlayer(team1, rng) : getRandomPlayer(team2, rng)} sarı kart gördü.`
      });
    } else if (eventType < 0.55) {
      // Red card (rare)
      const team = rng.next() < 0.5 ? 'home' : 'away';
      events.push({
        minute,
        type: 'red',
        team,
        description: `🟥 Kırmızı kart! ${team === 'home' ? getRandomPlayer(team1, rng) : getRandomPlayer(team2, rng)} oyun dışı kaldı!`
      });
    } else {
      // Tactical moment
      const team = rng.next() < 0.5 ? 'home' : 'away';
      const tacticalMoments = [
        'Hızlı kontra atak savunmayı yarıyor!',
        'Orta sahada üstünlük kuruldu.',
        'Presing etkisini gösteriyor.',
        'Kanatlarda tehlikeli ataklar geliyor.',
        'Set piece pozisyonu tehlike yaratıyor.'
      ];
      events.push({
        minute,
        type: 'tactical',
        team,
        description: tacticalMoments[rng.range(0, tacticalMoments.length - 1)]
      });
    }
  }

  // Sort events by minute
  events.sort((a, b) => a.minute - b.minute);

  // Add half-time event
  events.push({
    minute: 45,
    type: 'tactical',
    team: 'home',
    description: `HT · Devre arası · Skor: ${homeScore}-${awayScore}`
  });

  // Calculate match statistics
  const possessionBase = adjustedStrength1 / (adjustedStrength1 + adjustedStrength2);
  const possession1 = Math.round(possessionBase * 100);
  const possession2 = 100 - possession1;

  const shots1 = rng.range(5, 20);
  const shots2 = rng.range(5, 20);

  const xG1 = homeScore + rng.next() * 2;
  const xG2 = awayScore + rng.next() * 2;

  const passAcc1 = Math.round(70 + (adjustedStrength1 - 70) / 3 + rng.next() * 10);
  const passAcc2 = Math.round(70 + (adjustedStrength2 - 70) / 3 + rng.next() * 10);

  return {
    homeScore,
    awayScore,
    events,
    stats: {
      possession: [possession1, possession2],
      shots: [shots1, shots2],
      xG: [xG1, xG2],
      passAccuracy: [passAcc1, passAcc2]
    }
  };
}

function calculateTeamStrength(team: Team): number {
  if (team.roster.length === 0) return 60;

  // Calculate average overall
  const avgOverall = team.roster.reduce((sum, player) => sum + player.baseOverall, 0) / team.roster.length;

  // Check for position coverage
  const positions = new Set(team.roster.map(p => p.primaryPosition));
  const positionBonus = positions.has('GK') ? 5 : 0;

  // Archetype diversity bonus
  const archetypes = new Set(team.roster.map(p => p.archetype));
  const diversityBonus = Math.min(archetypes.size * 0.5, 3);

  return avgOverall + positionBonus + diversityBonus;
}

function calculateBonus(team: Team): number {
  let bonus = 0;

  // Formation bonus
  if (team.formation) {
    bonus += 2;
  }

  // Tactics bonus
  if (team.tactic) {
    bonus += 2;
  }

  // Budget efficiency (spent wisely)
  const budgetUsed = 100 - team.budget;
  if (budgetUsed > 80) {
    bonus += 3;
  }

  // Scout usage bonus
  if (team.scouts < 3) {
    bonus += (3 - team.scouts);
  }

  // Buff
  bonus += team.buff;

  return bonus;
}

function getRandomPlayer(team: Team, rng: SeededRandom): string {
  if (team.roster.length === 0) return 'Oyuncu';

  const player = team.roster[rng.range(0, team.roster.length - 1)];
  return player.name.split(' ')[0]; // First name only
}
