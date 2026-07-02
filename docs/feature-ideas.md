# Sports Management Sim Feature Ideas

Working notes for future gameplay slices. The current game already has a playable dynasty skeleton: 36-team college lacrosse landscape, weekly sim, recruiting, transfer portal, scouting, injuries, rankings, awards, news, tournaments, game plans, coach goals/firings, save slots, and custom team import.

## Recommended next roadmap

1. Fix test/localStorage stability.
2. Build a Weekly Hub / Coach Desk that makes the week-to-week loop feel intentional.
3. Upgrade the sim from team-level stats to player-driven stat allocation.
4. Add richer player profiles and career history.
5. ~~Add recruiting visits~~ (done: weekly recruiting hours, motivation pitches, campus visits, decision weeks/finalists, decommits, signing-day flips) — promises still open.
6. Add morale and transfer-risk consequences.

The shortest path to “this is addictive” is: Weekly Hub + player stories + recruiting promises.

## 1. Weekly Hub / Coach Desk

Goal: turn the main season loop from “click Sim Week” into “run the program this week.”

Ideas:
- Next opponent card with record, ranking, location, team OVR, and recent form.
- Key matchup callouts, e.g. “Your FOGO vs their faceoff unit” or “Their goalie vs your attack.”
- Win probability / upset risk based on rating edge, location, injuries, and morale.
- Weekly focus choice before sim:
  - scout opponent
  - install offense
  - extra goalie reps
  - recruiting visit weekend
  - rest / injury prevention
- Post-week recap:
  - result headline
  - standout players
  - recruiting movement
  - injury updates
  - ranking movement
  - AD confidence impact

## 2. Player development stories

Goal: make individual players memorable across seasons.

Ideas:
- Player development traits:
  - late bloomer
  - gym rat
  - injury prone
  - big game
  - inconsistent
  - raw athlete
- Development influenced by:
  - class year
  - potential
  - playing time
  - training focus
  - injuries
  - staff quality
- Development report lines:
  - “SO ATT Ryan Walsh added +4 shooting after a breakout spring.”
  - “FR GK Nate Bell is pushing for the starting job.”
  - “JR MID Carter Lee appears to have plateaued.”

## 3. Playing-time promises

Goal: make recruiting and roster management create long-term consequences.

Recruit/player motivations:
- early playing time
- championship contender
- close to home
- academics
- high-tempo offense
- elite facilities
- coach stability

Possible promises:
- starter by sophomore year
- immediate rotation role
- primary FOGO
- developmental/redshirt plan
- offense built around player

Broken promises should affect morale, transfer risk, and recruiting reputation.

## 4. Morale and locker room

Goal: create roster tension and transfer risk beyond ratings.

Morale inputs:
- playing time
- wins/losses
- broken promises
- being passed on depth chart
- coach prestige/stability
- injuries
- rivalry wins/losses

Effects:
- small performance modifiers
- transfer likelihood
- development volatility
- leadership boosts

UI ideas:
- Team screen shows “Locker Room: Stable / Fractured / Buying In.”
- Player rows show role satisfaction and transfer risk.

## 5. Player-driven game simulation

Goal: make box scores, awards, and career stats reflect actual roster construction.

Current sim is team-rating driven. Next layer should allocate production to players using depth chart, ratings, traits, and game plan.

Ideas:
- Goals weighted by ATT/MID usage, shooting, dodging, and role.
- Assists weighted by passing and offensive role.
- Faceoff wins tied to FOGO rating.
- Saves tied to goalie traits.
- Caused turnovers/ground balls tied to DEF/LSM traits.
- High-tempo plans increase possessions and fatigue/injury risk.
- Slow possession plans reduce variance and upset volatility.

## 6. Player cards / profile pages

Goal: make players worth caring about.

Profile sections:
- bio: class, position, hometown/region, recruit stars, archetype
- ratings: OVR, potential, lacrosse traits
- current season stats
- career stats by season
- awards
- development history
- morale / role / promises
- transaction log: recruited, transferred, injured, award winner, tournament hero

## 7. Rivalries and big-game texture

Goal: make the college sports world feel alive.

Ideas:
- Predefined rivalry pairs and generated rivalries after repeated tournament meetings.
- Rivalry week news and extra AD/fan impact.
- Morale boost for rivalry wins.
- Increased variance in rivalry games.
- Rivalry trophies or series history.

## 8. Program identity

Goal: make each school/save feel distinct.

Program identities:
- run-and-gun offense
- defensive grinder
- faceoff factory
- goalie school
- recruiting powerhouse
- transfer portal mercenary
- academic prestige program
- blue-collar developmental program

Effects:
- generated roster shape
- recruit interest
- CPU game plans
- development bonuses
- news flavor
- coach job offers

The user’s identity could evolve based on multi-year choices.

## 9. Recruiting visits and calendar events

Goal: add decisions beyond scout/offer.

Weekly actions:
- invite recruit to campus
- send assistant coach
- host rivalry game visit
- promise role
- pull offer
- soft pitch / hard pitch

Events:
- decommitments
- late risers
- camp standouts
- pipeline boosts
- rival steals
- signing day flips

## 10. Assistant coaches and staff

Goal: add Football Manager-style staff management without overbuilding.

Staff roles:
- offensive coordinator
- defensive coordinator
- recruiting coordinator
- goalie coach
- strength coach

Ratings:
- recruiting
- development
- tactics
- discipline
- scouting

Effects:
- scouting points per week
- player development
- game plan bonuses
- recruit interest
- injury prevention

## 11. Fog of war

Goal: force decisions under uncertainty.

Recruit fog:
- unscouted ratings are hidden/fuzzy
- star rating can be wrong
- potential hidden until fully scouted
- personality/motivation hidden

Opponent fog:
- CPU tendencies partially known
- recent games reveal tendencies
- scouting focus reveals weaknesses

## 12. Records and history

Goal: make year 5 feel different from year 1.

Track:
- national champions
- conference champions
- award winners
- team season records
- player career records
- coach career record
- rivalry series history
- hall of fame / program legends

## 13. Tournament drama

Goal: make the season climax feel like an event.

Ideas:
- bracket reveal show
- bubble watch
- bid stealers
- conference tournament previews
- upset alerts
- all-tournament team
- championship recap
- “Road to the Title” history card

## 14. Deeper tactical game plans

Goal: connect roster construction, scouting, and weekly decisions.

Offensive options:
- balanced
- dodge-heavy
- crease feeding
- outside shooting
- slow possession
- transition push

Defensive options:
- man
- zone
- aggressive doubles
- pack-in
- press ride
- conservative ride

Special focuses:
- attack matchup
- shut down star
- crash ground balls
- protect goalie
- exploit weak FOGO

## 15. Coach Goals 2.0

Goal: make AD confidence more legible and dramatic.

Goal types:
- minimum goals: finish .500, make conference tournament
- stretch goals: beat rival, sign top class, upset ranked team
- hidden AD priorities: academics, clean program, revenue/fan excitement, player development

Postseason meeting:
- AD grade
- confidence movement
- booster pressure
- job offers or firing

## 16. Abstract program resources / NIL layer

Goal: add long-term program building.

Possible resources:
- scholarship budget
- recruiting budget
- facilities
- donor support
- NIL collective strength
- academic support

Decisions:
- upgrade facilities
- fund recruiting travel
- boost retention
- hire staff
- invest in scouting

Keep it abstract and fictionalized so it stays gamey rather than becoming a legal/economic sim.
