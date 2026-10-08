/**
 * Plain-language definitions for the game's jargon. The "?" tips on key cards
 * and the Help page both read from here, so a term is explained the same way
 * everywhere.
 */
export type GlossaryCategory = 'Your week' | 'Games' | 'Recruiting' | 'Players' | 'Program';

export interface GlossaryEntry {
  id: GlossaryId;
  term: string;
  category: GlossaryCategory;
  definition: string;
}

export const GLOSSARY_CATEGORIES: readonly GlossaryCategory[] = ['Your week', 'Games', 'Recruiting', 'Players', 'Program'];

export const GLOSSARY = {
  continue: {
    term: 'Continue',
    category: 'Your week',
    definition:
      'The blue button at the top right always does the next thing and names it: play this week, start the postseason, run the offseason or start the new season.',
  },
  'win-prob': {
    term: 'Win Prob',
    category: 'Your week',
    definition:
      'Your chance to win the next game, from both teams’ ratings and home field. The game plan and the bounces can still swing it.',
  },
  series: {
    term: 'Series',
    category: 'Your week',
    definition: 'Your all-time record against this opponent across your dynasty, with the current streak.',
  },
  bracket: {
    term: 'Bracket (In / Bubble / Out)',
    category: 'Your week',
    definition:
      'Where you’d land if the NCAA field were picked today. In: you’re in the field. Bubble: one of the last few in or first few out. Out: you need to win more, or win your conference tournament for the automatic bid.',
  },
  'recruit-hours': {
    term: 'Recruit hours',
    category: 'Your week',
    definition:
      'Your staff’s time each week. Spend it to scout (1h), pitch (1h) or host a visit (3h). Unspent hours carry over, up to four weeks’ worth.',
  },
  edge: {
    term: 'Your edge',
    category: 'Games',
    definition:
      'Your unit minus theirs. OVR is team rating against team rating; OFF is your offense against their defense; DEF is your defense against their offense; GK and FO compare goalies and faceoff men. Green means you have the better of it.',
  },
  'game-plan': {
    term: 'Game plan',
    category: 'Games',
    definition:
      'Four calls for each game: tempo, defensive style, ride and midfield rotation. The staff plan fits your roster; the scout’s plan targets the opponent. Coach the Game lets you set it before the first half and change it at halftime.',
  },
  rpi: {
    term: 'RPI',
    category: 'Games',
    definition:
      'Rating Percentage Index: your win percentage blended with your opponents’ and their opponents’. The selection committee uses it, along with quality wins and bad losses, to pick and seed the NCAA field.',
  },
  'quality-wins': {
    term: 'QW / BL',
    category: 'Games',
    definition: 'Quality wins over top-quarter teams, and bad losses to bottom-half teams. Both move the committee.',
  },
  scholarships: {
    term: 'Scholarships',
    category: 'Recruiting',
    definition:
      'Each class gets 3.25 scholarship equivalents to split across offers. A 50% offer uses 0.50. Money offered to a recruit who signs elsewhere comes back to you.',
  },
  'offer-percent': {
    term: 'Offer size (25-100%)',
    category: 'Recruiting',
    definition:
      'How much of a full scholarship you offer. Bigger offers pull harder on recruits who care about money and help when he decides, but they eat the class budget.',
  },
  interest: {
    term: 'Interest',
    category: 'Recruiting',
    definition:
      'How much a recruit likes your program, 0-100. It is not a chance to land him: a rival can be at 100 too. Pitches and visits raise it.',
  },
  'chance-to-land': {
    term: 'Chance to land',
    category: 'Recruiting',
    definition:
      'Likely, Toss-up or Long shot: where the race for a recruit stands, counting rival offers, their interest, money and the weeks left before he decides. "If offered" means the odds assume you make a typical offer now.',
  },
  pitch: {
    term: 'Pitches',
    category: 'Recruiting',
    definition:
      'Sell what a recruit cares about: Close to Home, Big Stage, Scholarship $, Playing Time or Academics. Pitching what he values most moves interest the most; scouting reveals his motivations.',
  },
  scouting: {
    term: 'Scouting',
    category: 'Recruiting',
    definition:
      'Unscouted recruits show ?? for ratings. A first scout gives an estimate (~) and one motivation; a full scout confirms the rating and a second motivation. Top 100 recruits’ stars are public.',
  },
  'decision-week': {
    term: 'Decides Wk / Finalists',
    category: 'Recruiting',
    definition:
      'The week a recruit announces. Three weeks before, he names his finalists. A runaway leader can end it early.',
  },
  'staff-mode': {
    term: 'Staff each week',
    category: 'Recruiting',
    definition:
      'Off: you do everything. Scout and pitch: the staff spends your hours on the recruits you’ve offered or pinned and scouts good fits. Full control: it also makes offers, only where you have a real chance.',
  },
  ovr: {
    term: 'OVR / POT',
    category: 'Players',
    definition: 'Overall is how good a player is now; potential is the ceiling he can develop toward with practice and time.',
  },
  'stat-abbreviations': {
    term: 'G, A, GB, CT, FO%',
    category: 'Players',
    definition:
      'Goals, assists, ground balls (loose balls won), caused turnovers (takeaways on defense) and faceoff win percentage.',
  },
  depth: {
    term: 'Depth chart',
    category: 'Players',
    definition: 'Who starts and who rotates at each position. Injuries open spots; the staff fills them unless you set it.',
  },
  morale: {
    term: 'Morale',
    category: 'Players',
    definition: 'How happy a player is. Low morale hurts play and can send him to the transfer portal. Playing time, wins and captains help.',
  },
  redshirt: {
    term: 'Redshirt',
    category: 'Players',
    definition: 'A player who sits the season keeps a year of eligibility and still develops. Best for freshmen who won’t play.',
  },
  prestige: {
    term: 'Prestige',
    category: 'Program',
    definition:
      'Your program’s national standing. It decides which recruits will listen and grows with winning, titles and investments.',
  },
  'job-security': {
    term: 'Job security',
    category: 'Program',
    definition: 'Your athletic director’s confidence in you. Meet your season goals to raise it; fall too low and you can be fired.',
  },
  investments: {
    term: 'Program investments',
    category: 'Program',
    definition: 'Points from the athletic department each offseason for facilities, fan engagement and academics. Unspent points are lost.',
  },
  portal: {
    term: 'Transfer portal',
    category: 'Program',
    definition: 'Players leaving other programs in the offseason. Offer from your free scholarship room; everyone picks a school when the season starts.',
  },
  pipeline: {
    term: 'Pipelines',
    category: 'Program',
    definition: 'Sign two scholarship players from one region outside your own and recruits there start to warm to you.',
  },
} as const satisfies Record<string, Omit<GlossaryEntry, 'id'>>;

export type GlossaryId = keyof typeof GLOSSARY;

export function glossaryEntry(id: GlossaryId): GlossaryEntry {
  return { id, ...GLOSSARY[id] };
}

/** Every entry in a category, in the order written. */
export function glossaryByCategory(category: GlossaryCategory): GlossaryEntry[] {
  return (Object.keys(GLOSSARY) as GlossaryId[]).filter((id) => GLOSSARY[id].category === category).map(glossaryEntry);
}

/** Entries whose term or definition mention the query, for the Help page search. */
export function searchGlossary(query: string): GlossaryEntry[] {
  const q = query.trim().toLowerCase();
  const all = (Object.keys(GLOSSARY) as GlossaryId[]).map(glossaryEntry);
  if (!q) return all;
  return all.filter((e) => e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q));
}
