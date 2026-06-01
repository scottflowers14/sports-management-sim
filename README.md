# Sports Management Sim

Desktop sports management simulation foundation.

Initial target: men's college lacrosse management sim.

Architecture:

- `packages/engine-core`: reusable TypeScript sim engine primitives and models.
- `packages/sport-lacrosse`: lacrosse-specific adapter types and rules.
- `apps/desktop`: future Tauri + React desktop shell.

The first implementation milestone is the core data model for players, teams, seasons, and a lacrosse adapter that can express college lacrosse-specific roster and scholarship rules.
