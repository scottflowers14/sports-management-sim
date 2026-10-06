// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StartScreen } from './StartScreen';
import type { DynastySaveMetadata } from '../persistence';

const save = (saveId: string, extra: Partial<DynastySaveMetadata> = {}): DynastySaveMetadata => ({
  saveId,
  dynastyId: saveId,
  name: `Save ${saveId}`,
  userTeamId: 'md',
  userTeamName: 'Maryland State',
  seasonYear: 2031,
  currentWeek: 1,
  record: { wins: 0, losses: 0 },
  seed: 1,
  createdAt: 'x',
  updatedAt: 'x',
  ...extra,
});

describe('StartScreen save slots', () => {
  it('shows each career legacy and difficulty from the profile', () => {
    const noop = () => {};
    render(
      <StartScreen
        saves={[save('a', { difficulty: 'hard' }), save('b')]}
        teamChoices={[{ id: 'md', name: 'Maryland State', prestige: 85 } as never]}
        selectedTeamId="md"
        coachName="Pat Lee"
        onTeamChange={noop}
        onCoachNameChange={noop}
        onCreateDynasty={noop}
        onLoadSave={noop}
        onDeleteSave={noop}
        saveLegacies={{ a: 'Elite' }}
      />,
    );
    expect(screen.getByText(/2031 Week 1 · 0–\s*0 · Elite legacy/)).toBeInTheDocument();
    expect(screen.getByText('Hard')).toHaveClass('difficulty-tag');
    // A save the profile has no career for (no finished season yet) shows no legacy.
    expect(screen.getAllByText(/legacy/)).toHaveLength(1);
  });
});
