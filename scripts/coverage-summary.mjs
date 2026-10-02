// Prints a per-package coverage table (Markdown) from coverage/coverage-summary.json.
// CI appends it to the job summary so coverage shows up on every run.
import { readFileSync } from 'node:fs';

const summary = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
const groups = new Map();
for (const [file, metrics] of Object.entries(summary)) {
  if (file === 'total') continue;
  const match = file.match(/\/(packages\/[^/]+|apps\/[^/]+)\//);
  const name = match ? match[1] : 'other';
  const group = groups.get(name) ?? { lines: [0, 0], branches: [0, 0], functions: [0, 0] };
  for (const key of ['lines', 'branches', 'functions']) {
    group[key][0] += metrics[key].covered;
    group[key][1] += metrics[key].total;
  }
  groups.set(name, group);
}

const pct = ([covered, total]) => (total === 0 ? '–' : `${((covered / total) * 100).toFixed(1)}%`);
const rows = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
console.log('### Test coverage\n');
console.log('| Package | Lines | Branches | Functions |');
console.log('| --- | --- | --- | --- |');
for (const [name, g] of rows) console.log(`| ${name} | ${pct(g.lines)} | ${pct(g.branches)} | ${pct(g.functions)} |`);
