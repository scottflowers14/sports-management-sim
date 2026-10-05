// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { applyPortalOffer } from '@sports-management-sim/engine-core';
import {
  createNewLacrosseDynasty,
  formatNil,
  nilPortalDealCost,
  nilRetentionAsk,
  nilRetentionRoll,
  NIL_RETENTION_ODDS,
  openLacrossePortal,
  pitchNilRetention,
  signNilPortalDeal,
  type LacrossePortalEntry,
  type NilState,
} from '@sports-management-sim/sport-lacrosse';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { PortalBoard } from './PortalBoard';

const dynasty = createNewLacrosseDynasty({ seed: 11, userTeamId: 'maryland-state', seasonYear: 2028 });
const portal = openLacrossePortal(dynasty.season.teams, { seed: 11, season: 2029 });
// Play as whichever program lost the most players, so there is someone to keep.
const counts = new Map<string, number>();
for (const e of portal.entries) counts.set(e.sourceTeamId, (counts.get(e.sourceTeamId) ?? 0) + 1);
const userTeamId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
const SEED = 3;

function Harness({ budget }: { budget: number }) {
  const [entries, setEntries] = useState<LacrossePortalEntry[]>(portal.entries);
  const [teams, setTeams] = useState(portal.teams);
  const [nil, setNil] = useState<NilState>({ year: 2029, budget, deals: [] });
  return (
    <PortalBoard
      entries={entries}
      teams={teams}
      userTeamId={userTeamId}
      teamMap={new Map(teams.map((t) => [t.id, t.name]))}
      seasonYear={2029}
      scholarshipRoom={3}
      onOffer={(id, pct) => setEntries((es) => es.map((e) => (e.id === id ? applyPortalOffer(e, userTeamId, pct) : e)))}
      onWithdraw={() => {}}
      nil={{
        state: nil,
        onRetain: (id) => {
          const r = pitchNilRetention(nil, teams, entries, id, userTeamId, SEED)!;
          setNil(r.state);
          setEntries(r.entries);
          setTeams(r.teams);
        },
        onDeal: (id) => {
          const r = signNilPortalDeal(nil, entries, id, userTeamId)!;
          setNil(r.state);
          setEntries(r.entries);
        },
      }}
    />
  );
}

afterEach(cleanup);

describe('PortalBoard NIL', () => {
  it('pays a departure to stay or marks the refusal', async () => {
    render(<Harness budget={5_000_000} />);
    const ours = portal.entries.filter((e) => e.sourceTeamId === userTeamId);
    const first = ours[0]!;
    const name = `${first.name.first} ${first.name.last}`;
    await userEvent.click(screen.getByRole('button', { name: `NIL deal to keep ${name}` }));
    const kept = nilRetentionRoll(first.id, SEED) < NIL_RETENTION_ODDS[first.reason];
    const list = screen.queryByLabelText('Our players in the portal');
    if (kept) {
      expect(list === null || !within(list).queryByText(name)).toBe(true);
      expect(screen.getByText(/^NIL collective:/)).toHaveTextContent(`NIL collective: ${formatNil(5_000_000 - nilRetentionAsk(first))} of`);
    } else {
      expect(within(list!).getByText('Turned down NIL')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: `NIL deal to keep ${name}` })).not.toBeInTheDocument();
    }
  });

  it('adds NIL to a portal offer and disables deals the collective cannot afford', async () => {
    const target = [...portal.entries].filter((e) => e.sourceTeamId !== userTeamId).sort((a, b) => b.ratings.overall - a.ratings.overall)[0]!;
    render(<Harness budget={nilPortalDealCost(target)} />);
    const name = `${target.name.first} ${target.name.last}`;
    const row = screen.getAllByRole('row').find((r) => within(r).queryByText(name))!;
    await userEvent.selectOptions(within(row).getByRole('combobox'), '25');
    await userEvent.click(within(row).getByRole('button', { name: 'Offer' }));
    await userEvent.click(screen.getByRole('button', { name: `Add NIL to offer for ${name}` }));
    expect(within(screen.getAllByRole('row').find((r) => within(r).queryByText(name))!).getByText('+NIL')).toBeInTheDocument();
    expect(screen.getByText(/^NIL collective:/)).toHaveTextContent('NIL collective: $0k of');
    // The pot is spent, so every remaining retention pitch is out of reach.
    for (const button of screen.getAllByRole('button', { name: /^NIL deal to keep/ })) expect(button).toBeDisabled();
  });
});
