import { expect, test, type Page } from '@playwright/test';

/** Collect uncaught errors and console errors so any of them fails the run. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test('plays a season through the title game and offseason into year two', async ({ page }) => {
  const errors = trackErrors(page);
  // Dynasty seeds come from the clock; pin it so every run plays the same league.
  await page.clock.setFixedTime(new Date('2026-10-02T12:00:00Z'));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole('button', { name: 'Start New Dynasty' }).click();
  // A new coach is welcomed once, then the first-season checklist takes over.
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByLabel("Coach's checklist")).toContainText('0/5 done');
  const advance = page.locator('.advance-btn');
  await expect(advance).toContainText('Week 1');

  // Hire into an empty chair on the Staff screen.
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Staff' }).click();
  const staffCard = page.getByLabel('Coaching staff');
  await staffCard.getByRole('button', { name: 'Release' }).first().click();
  await expect(staffCard).toContainText('Vacant');
  // Released payroll always covers at least one candidate; pricier ones can be disabled.
  await page.getByLabel('Staff candidates').getByRole('button', { name: 'Hire', disabled: false }).first().click();
  await expect(page.getByLabel('Staff candidates').getByRole('button', { name: 'Hire' })).toHaveCount(11);

  // Crank up practice; the staff's development plans are already in place.
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Practice' }).click();
  await page.getByRole('radio', { name: /Intense/ }).click();
  await expect(page.getByRole('radio', { name: /Intense/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('Development plans').getByRole('button', { name: 'Remove' })).toHaveCount(4);

  // One week by hand, then the recruiting assistant.
  await advance.click();
  // The result card ticks the score up, then stamps the result.
  const reveal = page.getByRole('dialog', { name: 'Game result' });
  await expect(reveal.locator('.reveal-stamp')).toHaveText(/WIN|LOSS|UPSET|TROPHY/, { timeout: 5000 });
  await reveal.getByRole('button', { name: 'Continue' }).click();
  await expect(reveal).toHaveCount(0);
  await expect(advance).toContainText('Week 2');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Recruiting' }).click();
  await page.getByRole('button', { name: 'Run Assistant' }).click();
  await expect(page.getByLabel('Recruiting assistant report')).toContainText(/Scouting \(\d+\)/);

  // Rest of the regular season, then every postseason round.
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Season' }).click();
  await page.getByRole('button', { name: /Sim to End of Season/ }).click();
  await expect(advance).toContainText('Postseason');
  for (let round = 0; round < 8 && !(await advance.innerText()).includes('Offseason'); round += 1) {
    await advance.click();
  }
  await expect(page.locator('.ncaa-bracket')).toBeVisible();
  await expect(page.locator('.national-champion-banner')).toBeVisible();

  // The News feed has this season's stories.
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /News/ }).click();
  await expect(page.locator('.news-week-heading').first()).toBeVisible();

  // One click runs the offseason; the transfer portal opens with it.
  await advance.click();
  await expect(page.getByLabel('Offseason to-do')).toContainText('Spend investment points');
  await expect(page.locator('.season-recap-card')).toBeVisible();
  await expect(advance).toContainText(/Season \d{4}/);
  const nextYear = (await advance.innerText()).match(/Season (\d{4})/)![1]!;
  await page.getByRole('button', { name: /Open the full portal/ }).click();
  const portal = page.getByLabel('Transfer portal');
  await expect(portal).toContainText(/\d+ in the portal/);
  // Offer the top transfer half a scholarship, then take it back, then re-offer.
  const topRow = portal.locator('.portal-table tbody tr').first();
  await topRow.locator('select').selectOption('50');
  await topRow.getByRole('button', { name: 'Offer' }).click();
  await expect(topRow).toContainText('50%');
  await topRow.getByRole('button', { name: /Withdraw/ }).click();
  await expect(topRow.getByRole('button', { name: 'Offer' })).toBeVisible();
  await topRow.locator('select').selectOption('50');
  await topRow.getByRole('button', { name: 'Offer' }).click();
  await expect(portal.locator('.portal-stats')).toContainText('1 our offers');

  // Starting the season settles the portal: every entry has an outcome.
  // Advance from the portal asks first while investment points sit unspent.
  await advance.click();
  await page.getByRole('dialog', { name: /Start the \d{4} season now/ }).getByRole('button', { name: 'Start anyway' }).click();
  await expect(advance).toContainText('Week 1');
  await expect(page.locator('.top-bar')).toContainText(`Season ${nextYear}`);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Recruiting' }).click();
  await page.getByRole('button', { name: 'Transfer Portal' }).click();
  await expect(page.getByLabel('Transfer portal results')).toContainText(/\d+ of \d+ transferred/);

  // Saves survive a reload.
  await page.getByRole('button', { name: 'Save Now' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.top-bar')).toContainText(`Season ${nextYear}`);

  expect(errors).toEqual([]);
});
