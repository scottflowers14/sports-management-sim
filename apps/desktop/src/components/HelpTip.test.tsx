// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelpTip, OpenHelpContext } from './HelpTip';
import { EdgeChips } from './EdgeChips';

afterEach(cleanup);

describe('HelpTip', () => {
  it('opens a definition on click and closes on Escape or a click elsewhere', async () => {
    render(
      <div>
        <HelpTip term="rpi" />
        <p>outside</p>
      </div>,
    );
    const button = screen.getByRole('button', { name: 'What is RPI?' });
    await userEvent.click(button);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Rating Percentage Index/);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await userEvent.click(button);
    await userEvent.click(screen.getByText('outside'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('links to the Help page when the app provides it', async () => {
    const openHelp = vi.fn();
    render(
      <OpenHelpContext.Provider value={openHelp}>
        <HelpTip term="series" />
      </OpenHelpContext.Provider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /What is Series/ }));
    await userEvent.click(screen.getByRole('button', { name: /All terms/ }));
    expect(openHelp).toHaveBeenCalled();
  });
});

describe('EdgeChips', () => {
  it('labels every edge from your side', () => {
    render(<EdgeChips preview={{ ratingEdge: 3, offenseEdge: -2, defenseEdge: 4, goalieEdge: 0, faceoffEdge: 1 }} />);
    const chips = screen.getByLabelText('Your edge');
    expect(chips).toHaveTextContent(/Your edge/);
    expect(chips).toHaveTextContent(/OVR\+3/);
    expect(chips).toHaveTextContent(/OFF-2/);
    expect(screen.getByTitle('Your offense vs their defense: -2')).toBeInTheDocument();
    expect(screen.getByTitle('Your defense vs their offense: +4')).toBeInTheDocument();
  });
});
