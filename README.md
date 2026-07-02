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
- Active recruiting on a weekly hours budget: scouting, pitches, and campus visits all draw from one pool of recruiting hours, so working one target hard means another goes cold. Pitches sell a specific angle (playing time, the big stage, scholarship money...) and only land when they match what scouting revealed the recruit cares about.
- Campus visits tied to the real schedule: invite a recruit to this week's home game and the result they watch drives the impression — a ranked win in front of a big-stage recruit is the best sales pitch there is.
- Recruiting drama: each recruit decides on their own timeline (blue-chips stretch toward signing day), publicly narrows to three finalists as the decision nears, can decommit when a rival clearly overtakes their pledge, and can flip on signing day — including flips you engineer with double-cost flip pitches.
- Equivalency-sport scholarship economics: a 3.25-equivalency class budget (one graduating class's share of the D1 cap of 12.6) split across 25/50/75/100% offers, where bigger money pulls harder on money-motivated recruits and budget is released if a target signs elsewhere.
- Prestige-gated recruiting: elite recruits expect elite programs — low-prestige schools see sharply dampened interest gains on 4–5★ targets while strong CPU programs put real money on them (75–100% offers on blue-chips), so rebuilds run through 3★ gems instead of poached blue-chips.
- CPU programs recruit like rivals, not scripts: offer slots recycle when a target signs elsewhere, boards are attainability-weighted so bottom-prestige schools chase depth they can actually land, offers stop when next year's roster projects full, and any program that whiffs on a class backfills with freshman walk-ons to stay playable.
- Authentic scouting fog: 4–5★ "Top 100" recruits have public star ratings like real national rankings, everyone else needs scouting, and scout reports also reveal what a recruit cares about (money, prestige, proximity, playing time, academics).
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
