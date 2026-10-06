// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProfileScreen } from './ProfileScreen';
import { emptyProfile } from '../profile';

describe('ProfileScreen legacy', () => {
  it('shows the current career legacy and a Legacy column per career', () => {
    const profile = {
      ...emptyProfile(),
      careers: {
        mine: { coachName: 'Pat Lee', teamName: 'Maryland State', firstYear: 2028, lastYear: 2037, seasons: 10, wins: 80, losses: 40, confTitles: 3, nationalTitles: 1 },
        old: { coachName: 'Sam Ortiz', teamName: 'Harbor City', firstYear: 2020, lastYear: 2021, seasons: 2, wins: 9, losses: 11, confTitles: 0, nationalTitles: 0, difficulty: 'hard' as const },
      },
    };
    render(<ProfileScreen profile={profile} dynastyAchievements={{}} activeSaveId="mine" />);
    expect(screen.getByLabelText('Current legacy')).toHaveTextContent('Legacy: Established (186) · 64 to Elite');
    expect(screen.getByLabelText('Pat Lee legacy')).toHaveTextContent('Established 186');
    expect(screen.getByLabelText('Sam Ortiz legacy')).toHaveTextContent('Up-and-Comer 9');
    expect(screen.getByText('Hard')).toHaveClass('difficulty-tag');
    // Each category header counts what's unlocked.
    expect(screen.getByLabelText('Career achievements')).toHaveTextContent(/Career 0\/\d+/);
  });
});
