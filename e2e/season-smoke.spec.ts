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

test('plays a season through the national title and reloads the save', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole('button', { name: 'Start New Dynasty' }).click();
  const advance = page.locator('.advance-btn');
  await expect(advance).toContainText('Week 1');

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
  for (let round = 0; round < 8 && !(await advance.innerText()).includes('Wrap Season'); round += 1) {
    await advance.click();
  }
  await expect(advance).toContainText('Wrap Season');
  await expect(page.locator('.ncaa-bracket')).toBeVisible();

  // The News feed has this season's stories.
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /News/ }).click();
  await expect(page.locator('.news-week-heading').first()).toBeVisible();

  // Saves survive a reload.
  await page.getByRole('button', { name: 'Save Now' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.top-team')).toContainText('Tournament Complete');

  expect(errors).toEqual([]);
});
