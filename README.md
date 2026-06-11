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
- Weekly game plans (offensive tempo and defensive style) that feed directly into the game simulation with real tradeoffs.
- Offseason training focus that accelerates development for a chosen position group.
- Coach career pressure: season goals, AD confidence, and firings — get fired and rebuild at a lower-prestige program from job offers.
- Conference and national tournaments, national rankings, news feed, box scores with play-by-play logs, and save slots with import/export.
