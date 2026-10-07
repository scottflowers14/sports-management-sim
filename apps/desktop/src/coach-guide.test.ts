import { describe, expect, it } from 'vitest';
import { NEW_COACH_GUIDE, VETERAN_COACH_GUIDE, coachGuideSteps, markGuideVisit, showCoachGuide } from './coach-guide';

describe('coach guide', () => {
  it('ticks each step off from the coach’s own progress', () => {
    const fresh = coachGuideSteps({ captainCount: 0, offersOut: 0, gamesPlayed: 0, visited: [] });
    expect(fresh.map((s) => s.done)).toEqual([false, false, false, false, false]);
    const done = coachGuideSteps({ captainCount: 2, offersOut: 1, gamesPlayed: 1, visited: ['team', 'season'] });
    expect(done.every((s) => s.done)).toBe(true);
    expect(fresh.find((s) => s.id === 'captains')!.nav).toBe('locker-room');
  });

  it('records visits only while the checklist is open, once each', () => {
    const once = markGuideVisit(NEW_COACH_GUIDE, 'team');
    expect(once.visited).toEqual(['team']);
    expect(markGuideVisit(once, 'team')).toBe(once);
    expect(markGuideVisit(VETERAN_COACH_GUIDE, 'team')).toBe(VETERAN_COACH_GUIDE);
  });

  it('shows only in the first season and until dismissed', () => {
    expect(showCoachGuide(NEW_COACH_GUIDE, 0)).toBe(true);
    expect(showCoachGuide(NEW_COACH_GUIDE, 1)).toBe(false);
    expect(showCoachGuide({ ...NEW_COACH_GUIDE, dismissed: true }, 0)).toBe(false);
    expect(showCoachGuide(VETERAN_COACH_GUIDE, 0)).toBe(false);
  });
});
