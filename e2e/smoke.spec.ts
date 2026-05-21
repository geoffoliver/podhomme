import { expect, test } from './fixtures';

test.describe('Smoke', () => {
  test('app loads and shows the main layout', async ({ page, db: _ }) => {
    await page.goto('/');

    // TopBar is visible with transport controls
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();

    // Now-playing shows idle state
    await expect(page.locator('[data-podhomme="episode-title"]')).toContainText(
      'Nothing playing',
    );
  });

  test('left pane shows All Podcasts and Favorites items', async ({
    page,
    db: _,
  }) => {
    await page.goto('/');

    const list = page.getByRole('listbox', { name: 'Podcast library' });
    await expect(
      list.getByRole('option', { name: /All Podcasts/ }),
    ).toBeVisible();
    await expect(list.getByRole('option', { name: /Favorites/ })).toBeVisible();
  });

  test('left pane footer has add, search, and refresh buttons', async ({
    page,
    db: _,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('button', { name: 'Add podcast by URL' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Search for podcasts' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Refresh all feeds' }),
    ).toBeVisible();
  });
});
