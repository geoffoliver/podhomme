import { test, expect } from './fixtures';

test.describe('Playback', () => {
  test.beforeEach(async ({ db }) => {
    const podcast = db.createPodcast({
      title: 'Test Podcast',
      feedUrl: 'https://feeds.example.com/test.rss',
    });
    db.createEpisode({
      podcastId: podcast.id,
      guid: 'ep-001',
      title: 'Episode One',
      audioUrl: 'http://localhost:4321/ep1.mp3',
      pubDate: new Date('2024-04-01'),
      duration: 1800,
      played: true,
    });
    const ep2 = db.createEpisode({
      podcastId: podcast.id,
      guid: 'ep-002',
      title: 'Episode Two',
      audioUrl: 'http://localhost:4321/ep2.mp3',
      pubDate: new Date('2024-05-01'),
      duration: 3600,
    });
    db.createQueueItem(ep2.id, 0);
  });

  test('loads an episode into the player when Play episode is clicked', async ({
    page,
  }) => {
    await page.goto('/');

    await page
      .getByRole('listbox', { name: 'Podcast library' })
      .getByRole('option', { name: /Test Podcast/ })
      .click();

    await page.getByRole('button', { name: 'Play episode' }).first().click();

    await expect(
      page.locator('[data-podhomme="episode-title"]'),
    ).not.toContainText('Nothing playing', { timeout: 5000 });
  });

  test('shows Pause button after loading an episode', async ({ page }) => {
    await page.goto('/');

    await page
      .getByRole('listbox', { name: 'Podcast library' })
      .getByRole('option', { name: /Test Podcast/ })
      .click();

    await page.getByRole('button', { name: 'Play episode' }).first().click();

    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('pauses when the Pause button is clicked', async ({ page }) => {
    await page.goto('/');

    await page
      .getByRole('listbox', { name: 'Podcast library' })
      .getByRole('option', { name: /Test Podcast/ })
      .click();

    await page.getByRole('button', { name: 'Play episode' }).first().click();
    await expect(
      page.getByRole('button', { name: 'Pause', exact: true }),
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Play', exact: true }),
    ).toBeVisible({ timeout: 5000 });
  });

  test('resumes when Play is clicked after pausing', async ({ page }) => {
    await page.goto('/');

    await page
      .getByRole('listbox', { name: 'Podcast library' })
      .getByRole('option', { name: /Test Podcast/ })
      .click();

    await page.getByRole('button', { name: 'Play episode' }).first().click();
    await expect(
      page.getByRole('button', { name: 'Pause', exact: true }),
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Play', exact: true }),
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Pause', exact: true }),
    ).toBeVisible({ timeout: 5000 });
  });

  test('All Podcasts view shows unplayed episode in queue', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByText('Episode Two')).toBeVisible();
    await expect(page.getByText('Episode One')).not.toBeVisible();
  });
});
