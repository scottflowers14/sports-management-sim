# Sports Management Sim

Desktop sports management simulation foundation.

Initial target: men's college lacrosse management sim.

Architecture:

- `packages/engine-core`: reusable TypeScript sim engine primitives and models.
- `packages/sport-lacrosse`: lacrosse-specific adapter types and rules.
- `apps/desktop`: future Tauri + React desktop shell.

The first implementation milestone is the core data model for players, teams, seasons, and a lacrosse adapter that can express college lacrosse-specific roster and scholarship rules.

Gameplay features:

- Multi-season dynasty with recruiting, scouting, transfer portal, injuries, and offseason player development.
- Two-level recruiting board: browse and sort the full national recruit pool, then pin prospects to a personal "My Board" shortlist that tracks offers, commitments, signings, and recruits lost to rivals.
- Weekly game plans (offensive tempo and defensive style) that feed directly into the game simulation with real tradeoffs.
- Offseason training focus that accelerates development for a chosen position group.
- Coach career pressure: season goals, AD confidence, and firings — get fired and rebuild at a lower-prestige program from job offers.
- Conference and national tournaments, national rankings, news feed, box scores with play-by-play logs, and save slots with import/export.
- Prestige-driven generated rosters: every program starts with a full 42-man roster (position groups, class-year spread, scholarship distribution) whose talent level tracks its national prestige.
- A 36-team national landscape referencing real college lacrosse conferences (ACC, Big Ten, Ivy League, Big East, Patriot League, ASUN) with real-style scheduling: five non-conference weeks followed by a single conference round-robin — league rivals meet once, with rematches saved for the conference tournament.

Custom teams files (Start screen → import teams) may optionally include a `roster` array per team:

```json
{
  "id": "my-team",
  "name": "My Team",
  "...": "...",
  "roster": [
    { "firstName": "Pat", "lastName": "Spencer", "position": "ATT", "classYear": "SR", "overall": 92, "potential": 95 }
  ]
}
```

Positions are `ATT`/`MID`/`DEF`/`LSM`/`GK`/`FOGO`; class years `FR`/`SO`/`JR`/`SR`; `potential` is optional. Rosters need 12–45 players including at least one GK and one FOGO. Teams without a `roster` get a generated one matching their prestige.
