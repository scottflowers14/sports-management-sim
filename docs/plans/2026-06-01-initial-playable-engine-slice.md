# Initial Playable Engine Slice Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build the first non-UI playable engine slice: validate a lacrosse roster, generate a small season schedule, simulate games, and advance a season week-by-week.

**Architecture:** Keep `packages/engine-core` generic and reusable across future sports. Put lacrosse-specific constraints, ratings interpretation, and box-score details in `packages/sport-lacrosse`. Do not add Tauri/React UI until the engine can run a tiny season entirely in tests.

**Tech Stack:** TypeScript, npm workspaces, Vitest, strict TypeScript project references.

---

### Task 1: Add Shared Result Type

**Objective:** Provide a small typed result helper for validations without throwing exceptions for normal game-rule failures.

**Files:**
- Create: `packages/engine-core/src/result.ts`
- Modify: `packages/engine-core/src/index.ts`
- Test: `packages/engine-core/src/result.test.ts`

**Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest';
import { failure, success } from './result';

describe('Result helpers', () => {
  it('represents success and failure values', () => {
    expect(success(123)).toEqual({ ok: true, value: 123 });
    expect(failure('bad')).toEqual({ ok: false, error: 'bad' });
  });
});
```

**Step 2: Run test to verify failure**

Run: `npm test -- packages/engine-core/src/result.test.ts`
Expected: FAIL because `./result` does not exist.

**Step 3: Write minimal implementation**

```ts
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function success<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function failure<E = string>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

Add to `packages/engine-core/src/index.ts`:

```ts
export * from './result';
```

**Step 4: Run test to verify pass**

Run: `npm test -- packages/engine-core/src/result.test.ts`
Expected: PASS.

**Step 5: Run full verification**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/engine-core/src/result.ts packages/engine-core/src/result.test.ts packages/engine-core/src/index.ts
git commit -m "feat: add engine result helper"
```

---

### Task 2: Add Generic Team Scholarship Validation

**Objective:** Validate that a team does not exceed its scholarship limit.

**Files:**
- Create: `packages/engine-core/src/team-validation.ts`
- Modify: `packages/engine-core/src/index.ts`
- Test: `packages/engine-core/src/team-validation.test.ts`

**Step 1: Write failing test**

Test two behaviors:
- valid when `scholarshipUsed <= scholarshipLimit`
- invalid when `scholarshipUsed > scholarshipLimit`

**Step 2: Run test to verify failure**

Run: `npm test -- packages/engine-core/src/team-validation.test.ts`
Expected: FAIL because module does not exist.

**Step 3: Implement**

Add:

```ts
import type { Team } from './models';
import { failure, success, type Result } from './result';

export function validateTeamScholarships(team: Team): Result<Team> {
  if (team.resources.scholarshipUsed > team.resources.scholarshipLimit) {
    return failure(
      `Team ${team.id} exceeds scholarship limit: ${team.resources.scholarshipUsed}/${team.resources.scholarshipLimit}`,
    );
  }

  return success(team);
}
```

Export it from `packages/engine-core/src/index.ts`.

**Step 4: Verify**

Run:

```bash
npm test -- packages/engine-core/src/team-validation.test.ts
npm test
npm run typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/engine-core/src/team-validation.ts packages/engine-core/src/team-validation.test.ts packages/engine-core/src/index.ts
git commit -m "feat: validate team scholarship limits"
```

---

### Task 3: Add Lacrosse Roster Validation

**Objective:** Enforce first-pass college lacrosse roster constraints in the sport adapter.

**Files:**
- Create: `packages/sport-lacrosse/src/roster-validation.ts`
- Modify: `packages/sport-lacrosse/src/index.ts`
- Test: `packages/sport-lacrosse/src/roster-validation.test.ts`

**Initial constraints:**
- roster should have at most 45 players
- roster should include at least one `GK`
- roster should include at least one `FOGO`
- scholarships should not exceed 12.6

**Step 1: Write failing tests**

Create tests for:
- a valid 45-player roster with GK and FOGO passes
- 46 players fails
- missing GK fails
- missing FOGO fails
- scholarship use above 12.6 fails

**Step 2: Run tests to verify failure**

Run: `npm test -- packages/sport-lacrosse/src/roster-validation.test.ts`
Expected: FAIL because module does not exist.

**Step 3: Implement minimal validation**

Return `Result<LacrosseTeam, string[]>` so multiple roster errors can be displayed at once.

**Step 4: Verify**

Run:

```bash
npm test -- packages/sport-lacrosse/src/roster-validation.test.ts
npm test
npm run typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/sport-lacrosse/src/roster-validation.ts packages/sport-lacrosse/src/roster-validation.test.ts packages/sport-lacrosse/src/index.ts
git commit -m "feat: validate lacrosse roster constraints"
```

---

### Task 4: Add Basic Lacrosse Game Simulator

**Objective:** Simulate one lacrosse game from team ratings and produce a final score with team stats.

**Files:**
- Create: `packages/sport-lacrosse/src/simulate-game.ts`
- Modify: `packages/sport-lacrosse/src/index.ts`
- Test: `packages/sport-lacrosse/src/simulate-game.test.ts`

**Design:**
Use a deterministic RNG function dependency so tests are repeatable.

```ts
export type RandomSource = () => number;
```

**Step 1: Write failing tests**

Test that:
- a simulated game returns `homeScore`, `awayScore`, winner, loser, and lacrosse team stats
- scores are non-negative integers
- deterministic RNG gives deterministic results

**Step 2: Run test to verify failure**

Run: `npm test -- packages/sport-lacrosse/src/simulate-game.test.ts`
Expected: FAIL because module does not exist.

**Step 3: Implement simple simulation**

First version can be deliberately abstract:
- calculate team strength from roster average overall
- generate possessions around 40-55 per team
- convert some possessions into goals based on strength and RNG
- produce basic stats

Do not model substitutions or player stats yet.

**Step 4: Verify**

Run:

```bash
npm test -- packages/sport-lacrosse/src/simulate-game.test.ts
npm test
npm run typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/sport-lacrosse/src/simulate-game.ts packages/sport-lacrosse/src/simulate-game.test.ts packages/sport-lacrosse/src/index.ts
git commit -m "feat: simulate basic lacrosse game results"
```

---

### Task 5: Add Round-Robin Schedule Generator

**Objective:** Generate a tiny deterministic schedule for a group of teams.

**Files:**
- Create: `packages/engine-core/src/schedule.ts`
- Modify: `packages/engine-core/src/index.ts`
- Test: `packages/engine-core/src/schedule.test.ts`

**Step 1: Write failing tests**

Test that four teams generate six games and that every pair plays once.

**Step 2: Run test to verify failure**

Run: `npm test -- packages/engine-core/src/schedule.test.ts`
Expected: FAIL because module does not exist.

**Step 3: Implement**

Add `createRoundRobinSchedule(teamIds, seasonYear)` returning `ScheduledGame[]`.

**Step 4: Verify**

Run:

```bash
npm test -- packages/engine-core/src/schedule.test.ts
npm test
npm run typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/engine-core/src/schedule.ts packages/engine-core/src/schedule.test.ts packages/engine-core/src/index.ts
git commit -m "feat: generate round robin schedules"
```

---

### Task 6: Add Season Advancement Function

**Objective:** Advance a season by simulating all scheduled games for the current week and updating standings.

**Files:**
- Create: `packages/engine-core/src/season-advancement.ts`
- Modify: `packages/engine-core/src/index.ts`
- Test: `packages/engine-core/src/season-advancement.test.ts`

**Design:**
Engine-core should receive a sport-specific `simulateGame` callback rather than importing lacrosse.

**Step 1: Write failing tests**

Test that:
- scheduled games in the current week become final
- `currentWeek` increments
- team records update
- future week games remain scheduled

**Step 2: Run test to verify failure**

Run: `npm test -- packages/engine-core/src/season-advancement.test.ts`
Expected: FAIL because module does not exist.

**Step 3: Implement minimal advancement**

Keep it immutable: return a new `Season` object instead of mutating the existing one.

**Step 4: Verify**

Run:

```bash
npm test -- packages/engine-core/src/season-advancement.test.ts
npm test
npm run typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/engine-core/src/season-advancement.ts packages/engine-core/src/season-advancement.test.ts packages/engine-core/src/index.ts
git commit -m "feat: advance season weeks"
```

---

### Task 7: Add Tiny Lacrosse Season Integration Test

**Objective:** Prove that engine-core and sport-lacrosse work together to run a tiny season without UI.

**Files:**
- Create: `packages/sport-lacrosse/src/tiny-season.integration.test.ts`

**Step 1: Write failing integration test**

Create four lacrosse teams, generate a round-robin schedule, simulate all weeks, and assert:
- all games are final
- every team has wins + losses equal to 3
- standings contain all four teams

**Step 2: Run test to verify failure**

Run: `npm test -- packages/sport-lacrosse/src/tiny-season.integration.test.ts`
Expected: FAIL until previous tasks exist and integration is wired correctly.

**Step 3: Implement only integration wiring needed**

Do not add UI. Do not add persistence. Do not add recruiting yet.

**Step 4: Verify**

Run:

```bash
npm test -- packages/sport-lacrosse/src/tiny-season.integration.test.ts
npm test
npm run typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/sport-lacrosse/src/tiny-season.integration.test.ts
git commit -m "test: prove tiny lacrosse season simulation"
```

---

## Stop Point

After Task 7, the project has its first meaningful engine milestone: a tiny lacrosse season can run completely in TypeScript tests.

Only then should the next plan start on one of these tracks:

1. Recruiting model and recruit generation
2. Player progression and offseason advancement
3. Tauri + React UI shell for viewing teams/seasons
4. Save-game persistence
