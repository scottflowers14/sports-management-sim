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

  // One week by hand, then the recruiting assistant.
  await advance.click();
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

  // One click runs the offseason, a second starts year two.
  await advance.click();
  await expect(page.locator('.season-recap-card')).toBeVisible();
  await expect(advance).toContainText(/Season \d{4}/);
  const nextYear = (await advance.innerText()).match(/Season (\d{4})/)![1]!;
  await advance.click();
  await expect(advance).toContainText('Week 1');
  await expect(page.locator('.top-bar')).toContainText(`Season ${nextYear}`);

  // Saves survive a reload.
  await page.getByRole('button', { name: 'Save Now' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.top-bar')).toContainText(`Season ${nextYear}`);

  expect(errors).toEqual([]);
});
