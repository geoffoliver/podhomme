import { test, expect, FEED_URL } from './fixtures';

test.describe('Add podcast', () => {
  test('adds a podcast by RSS URL and shows it in the sidebar', async ({
    page,
    db: _,
  }) => {
    await page.goto('/');

    // Open the add URL form
    await page.getByRole('button', { name: 'Add podcast by URL' }).click();
    await page.getByRole('textbox', { name: 'RSS feed URL' }).fill(FEED_URL);
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    // Podcast should appear in the sidebar
    const list = page.getByRole('listbox', { name: 'Podcast library' });
    await expect(
      list.getByRole('option', { name: /Test Podcast/ }),
    ).toBeVisible();
  });

  test('shows episodes in the right pane after adding', async ({
    page,
    db: _,
  }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Add podcast by URL' }).click();
    await page.getByRole('textbox', { name: 'RSS feed URL' }).fill(FEED_URL);
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    // Click the podcast in the sidebar to open its view
    await page
      .getByRole('listbox', { name: 'Podcast library' })
      .getByRole('option', { name: /Test Podcast/ })
      .click();

    // Both episodes from the fixture feed should appear
    await expect(page.getByText('Episode 2: The Sequel')).toBeVisible();
    await expect(page.getByText('Episode 1: The Beginning')).toBeVisible();
  });

  test('shows an error if the RSS URL is unreachable', async ({
    page,
    db: _,
  }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Add podcast by URL' }).click();
    await page
      .getByRole('textbox', { name: 'RSS feed URL' })
      .fill('http://localhost:4321/does-not-exist.rss');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    // An error message should appear in the form
    await expect(page.getByText(/Could not parse feed/i)).toBeVisible();
  });

  test('shows an error if the podcast is already subscribed', async ({
    page,
    db,
  }) => {
    // Pre-seed so we already have the podcast
    db.createPodcast({ title: 'Test Podcast', feedUrl: FEED_URL });

    await page.goto('/');

    await page.getByRole('button', { name: 'Add podcast by URL' }).click();
    await page.getByRole('textbox', { name: 'RSS feed URL' }).fill(FEED_URL);
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(page.getByText(/already subscribed/i)).toBeVisible();
  });
});
