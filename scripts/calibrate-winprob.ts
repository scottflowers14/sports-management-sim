import { generateLacrosseRoster } from '../packages/sport-lacrosse/src/roster-generation';
import { makeLacrosseTeam } from '../packages/sport-lacrosse/src/test-fixtures';
import { simulateLacrosseGame } from '../packages/sport-lacrosse/src/simulate-game';
import { calculateLacrosseTeamRating } from '../packages/sport-lacrosse/src/team-rating';
function seededRandom(seed: number): () => number { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; }; }
const random = seededRandom(5);
const reps = Number(process.argv[2] ?? 24);
const teams = Array.from({ length: 16 }, (_, i) => makeLacrosseTeam(`t${i}`, generateLacrosseRoster({ seed: 100 + i, prestige: 40 + i * 3.3, createdSeason: 2028 })));
const overall = new Map(teams.map((t) => [t.id, calculateLacrosseTeamRating(t).overall]));
const buckets = new Map<number, { wins: number; games: number; edge: number }>();
for (const home of teams) for (const away of teams) {
  if (home === away) continue;
  const edge = overall.get(home.id)! - overall.get(away.id)!;
  const bucket = Math.round(edge / 4) * 4;
  const e = buckets.get(bucket) ?? { wins: 0, games: 0, edge: 0 };
  for (let k = 0; k < reps; k += 1) { const g = simulateLacrosseGame({ homeTeam: home, awayTeam: away, random, neutralSite: true }); e.wins += g.winnerTeamId === home.id ? 1 : 0; e.games += 1; e.edge += edge; }
  buckets.set(bucket, e);
}
let num = 0, den = 0;
for (const [b, e] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
  const p = e.wins / e.games; const avgEdge = e.edge / e.games;
  const logit = Math.log(p / (1 - p));
  if (e.games >= 600 && Math.abs(avgEdge) > 1 && p > 0.02 && p < 0.98) { num += avgEdge * logit; den += logit * logit; }
  console.log(`bucket ${b} games ${e.games} avgEdge ${avgEdge.toFixed(1)} win ${p.toFixed(3)} pts/logit ${(avgEdge / logit).toFixed(2)}`);
}
console.log('fit pts/logit', (num / den).toFixed(2));
