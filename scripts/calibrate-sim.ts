import { generateLacrosseRoster } from '../packages/sport-lacrosse/src/roster-generation';
import { makeLacrosseTeam } from '../packages/sport-lacrosse/src/test-fixtures';
import { simulateLacrosseGameWithLog } from '../packages/sport-lacrosse/src/game-log';
import { calculateLacrosseTeamRating } from '../packages/sport-lacrosse/src/team-rating';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
const teams = Array.from({ length: 24 }, (_, i) =>
  makeLacrosseTeam(`t${i}`, generateLacrosseRoster({ seed: i + 1, prestige: 45 + i * 2, createdSeason: 2028 })),
);
const rating = new Map(teams.map((t) => [t.id, calculateLacrosseTeamRating(t).overall]));
const random = seededRandom(11);
const N = Number(process.argv[2] ?? 3000);
const t: Record<string, number> = {};
const add = (k: string, v: number) => (t[k] = (t[k] ?? 0) + v);
const buckets = new Map<number, { w: number; g: number }>();
let events = 0;
for (let k = 0; k < N; k += 1) {
  const home = teams[Math.floor(random() * teams.length)]!;
  const away = teams[Math.floor(random() * teams.length)]!;
  if (home === away) continue;
  const r = simulateLacrosseGameWithLog({ homeTeam: home, awayTeam: away, random, neutralSite: process.argv[3] === 'neutral' });
  const { home: h, away: a } = r.teamStats!;
  add('games', 1);
  for (const s of [h, a]) {
    add('goals', s.goals); add('shots', s.shots); add('sog', s.shotsOnGoal); add('saves', s.saves); add('assists', s.assists);
    add('to', s.turnovers); add('ct', s.causedTurnovers); add('gb', s.groundBalls); add('clears', s.clears); add('clearAtt', s.clearAttempts);
    add('pen', s.penalties); add('pim', s.penaltyMinutes); add('fo', s.faceoffAttempts);
  }
  add('poss', r.log.possessions!.home + r.log.possessions!.away);
  add('emoG', r.log.extraMan!.home.goals + r.log.extraMan!.away.goals);
  add('emoC', r.log.extraMan!.home.chances + r.log.extraMan!.away.chances);
  events += r.log.events.length;
  if (r.overtime) add('ot', 1);
  const homeWon = r.winnerTeamId === home.id;
  if (homeWon) add('homeWins', 1);
  const gap = rating.get(home.id)! - rating.get(away.id)!;
  if (Math.abs(gap) <= 2) { add('even', 1); if (homeWon) add('evenHome', 1); }
  if (Math.abs(gap) >= 10) { add('fav', 1); if ((gap > 0) === homeWon) add('favWin', 1); }
  const b = Math.round(gap / 4) * 4;
  const e = buckets.get(b) ?? { w: 0, g: 0 };
  e.g += 1; e.w += homeWon ? 1 : 0; buckets.set(b, e);
  add('margin', Math.abs(r.homeScore - r.awayScore));
}
const g = t.games!;
const per = (k: string) => (t[k]! / g / 2).toFixed(2);
console.log(`games ${g} | per team: goals ${per('goals')} shots ${per('shots')} sog ${per('sog')} assists ${per('assists')} saves ${per('saves')} save% ${(t.saves! / t.sog!).toFixed(3)} sh% ${(t.goals! / t.shots!).toFixed(3)}`);
console.log(`to ${per('to')} ct ${per('ct')} gb ${per('gb')} clears ${per('clears')}/${per('clearAtt')} (${(t.clears! / t.clearAtt!).toFixed(3)}) pen ${per('pen')} pim ${per('pim')} fo ${per('fo')} poss ${per('poss')} emo ${per('emoG')}/${per('emoC')} (${(t.emoG! / t.emoC!).toFixed(2)})`);
console.log(`OT ${(t.ot! / g).toFixed(3)} home ${(t.homeWins! / g).toFixed(3)} evenHome ${(t.evenHome! / t.even!).toFixed(3)} (${t.even}) favWin ${(t.favWin! / t.fav!).toFixed(3)} (${t.fav}) margin ${(t.margin! / g).toFixed(2)} events/game ${(events / g).toFixed(0)}`);
console.log([...buckets.entries()].sort((a, b) => a[0] - b[0]).filter(([, e]) => e.g >= 80).map(([b, e]) => `${b}:${(e.w / e.g).toFixed(2)}`).join(' '));
