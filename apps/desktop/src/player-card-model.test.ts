import { describe, expect, it } from 'vitest';
import { cardFromPlayer, cardFromRecruit } from './player-card-model';
import type { LacrossePlayer, LacrosseRecruit } from '@sports-management-sim/sport-lacrosse';

function ratings(overall: number) {
  return {
    overall,
    potential: overall + 6,
    athleticism: 70,
    speed: 72,
    strength: 65,
    stamina: 68,
    skill: 80,
    iq: 75,
    discipline: 60,
    workEthic: 85,
    leadership: 55,
  };
}

const player = {
  name: { first: 'Ryan', last: 'Walsh' },
  position: 'ATT',
  classYear: 'JR',
  hometown: 'Baltimore, MD',
  ratings: ratings(84),
  traits: ['gym_rat', 'high_floor'],
  redshirtStatus: 'none',
  sportTraits: { shooting: 88, passing: 70, dodging: 81, stickSkills: 77, offBallMovement: 74, defense: 40, checking: 35, groundBalls: 60, preferredHand: 'left' },
} as unknown as LacrossePlayer;

const recruit = {
  name: { first: 'Cole', last: 'Banks' },
  position: 'MID',
  hometown: 'Garden City, NY',
  starRating: 4,
  status: 'open',
  ratings: ratings(78),
  sportTraits: { shooting: 72, passing: 80, dodging: 76, stickSkills: 74, offBallMovement: 70, defense: 66, checking: 50, groundBalls: 71, preferredHand: 'right' },
  preferences: { proximityImportance: 50, prestigeImportance: 80, scholarshipImportance: 40, playingTimeImportance: 30, academicImportance: 20 },
  interestByTeamId: {},
  scholarshipOffers: [],
} as unknown as LacrosseRecruit;

describe('cardFromPlayer', () => {
  it('exposes full ratings and humanized traits', () => {
    const card = cardFromPlayer(player, { injured: true });
    expect(card.name).toBe('Ryan Walsh');
    expect(card.subtitle).toBe('ATT · JR · Baltimore, MD');
    expect(card.overall).toBe(84);
    expect(card.overallFuzzy).toBe(false);
    expect(card.potential).toBe(90);
    expect(card.ratings.every((r) => r.value !== null)).toBe(true);
    expect(card.traits).toContain('gym rat');
    expect(card.badges.map((b) => b.label)).toContain('INJ');
  });
});

describe('cardFromRecruit', () => {
  it('hides ratings until scouted but shows public stars', () => {
    const card = cardFromRecruit(recruit, { tier: 'none', displayOvr: null, starsPublic: true });
    expect(card.overall).toBeNull();
    expect(card.potential).toBeNull();
    expect(card.ratings.every((r) => r.value === null)).toBe(true);
    expect(card.subtitle).toContain('★★★★☆');
    expect(card.badges.map((b) => b.label)).toContain('Top 100');
  });

  it('marks partially scouted OVR as fuzzy and keeps detailed ratings hidden', () => {
    const card = cardFromRecruit(recruit, { tier: 'partial', displayOvr: 76, starsPublic: false });
    expect(card.overall).toBe(76);
    expect(card.overallFuzzy).toBe(true);
    expect(card.ratings.every((r) => r.value === null)).toBe(true);
  });

  it('reveals everything once fully scouted', () => {
    const card = cardFromRecruit(recruit, { tier: 'full', displayOvr: 78, starsPublic: false });
    expect(card.overall).toBe(78);
    expect(card.overallFuzzy).toBe(false);
    expect(card.potential).toBe(84);
    expect(card.ratings.every((r) => r.value !== null)).toBe(true);
  });
});

describe('skills on the card', () => {
  it('shows the lacrosse skills that matter at his position', () => {
    expect(cardFromPlayer(player).skills).toEqual([
      { label: 'Shooting', value: 88 },
      { label: 'Dodging', value: 81 },
      { label: 'Passing', value: 70 },
      { label: 'Stick Skills', value: 77 },
      { label: 'Off-Ball', value: 74 },
    ]);
  });

  it('hides a recruit’s skills until he is fully scouted', () => {
    const hidden = cardFromRecruit(recruit, { tier: 'partial', displayOvr: 77, starsPublic: false });
    expect(hidden.skills.length).toBeGreaterThan(0);
    expect(hidden.skills.every((s) => s.value === null)).toBe(true);
    const shown = cardFromRecruit(recruit, { tier: 'full', displayOvr: 78, starsPublic: false });
    expect(shown.skills.find((s) => s.label === 'Passing')?.value).toBe(80);
  });
});
