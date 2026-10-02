import { generateLacrosseRoster } from '../packages/sport-lacrosse/src/roster-generation';
import { makeLacrosseTeam } from '../packages/sport-lacrosse/src/test-fixtures';
import { simulatePossessionGame } from '../packages/sport-lacrosse/src/possession-sim';
function seededRandom(seed: number): () => number { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; }; }
const random = seededRandom(3);
const teams = Array.from({ length: 12 }, (_, i) => makeLacrosseTeam(`t${i}`, generateLacrosseRoster({ seed: 50 + i, prestige: 45 + i * 4, createdSeason: 2028 })));
const goals = new Map<string, number>(); const shots = new Map<string, number>(); const games = new Map<string, number>();
for (let k = 0; k < 600; k += 1) {
  const h = teams[Math.floor(random() * 12)]!, a = teams[Math.floor(random() * 12)]!; if (h === a) continue;
  const g = simulatePossessionGame({ homeTeam: h, awayTeam: a, random });
  for (const l of [...g.players.home, ...g.players.away]) { goals.set(l.playerId, (goals.get(l.playerId) ?? 0) + l.goals); shots.set(l.playerId, (shots.get(l.playerId) ?? 0) + l.shots); games.set(l.playerId, (games.get(l.playerId) ?? 0) + 1); }
}
const rows = [...goals.entries()].map(([id, g]) => ({ id, gpg: g / games.get(id)!, spg: shots.get(id)! / games.get(id)!, gp: games.get(id)! })).sort((a, b) => b.gpg - a.gpg).slice(0, 8);
console.log(rows.map((r) => `${r.id} ${r.gpg.toFixed(2)} g/g ${r.spg.toFixed(1)} sh/g (${r.gp})`).join('\n'));
