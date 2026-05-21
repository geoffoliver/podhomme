import { expect, test } from './fixtures';

test.describe('Real-time sync (SSE)', () => {
  test.beforeEach(async ({ db }) => {
    const podcast = db.createPodcast({
      title: 'Sync Podcast',
      feedUrl: 'https://feeds.example.com/sync.rss',
    });
    const episode = db.createEpisode({
      podcastId: podcast.id,
      guid: 'sync-ep-001',
      title: 'Sync Episode',
      audioUrl: 'http://localhost:4321/sync.mp3',
      pubDate: new Date('2024-05-01'),
      duration: 1800,
    });
    db.createQueueItem(episode.id, 0);
  });

  test('play in one tab is reflected in a second tab', async ({
    page,
    context,
  }) => {
    const page2 = await context.newPage();

    await page.goto('/');
    await page2.goto('/');

    await page
      .getByRole('listbox', { name: 'Podcast library' })
      .getByRole('option', { name: /Sync Podcast/ })
      .click();
    await page.getByRole('button', { name: 'Play episode' }).click();

    await expect(
      page.locator('[data-podhomme="episode-title"]'),
    ).not.toContainText('Nothing playing', { timeout: 5000 });
    await expect(
      page2.locator('[data-podhomme="episode-title"]'),
    ).not.toContainText('Nothing playing', { timeout: 5000 });

    await page2.close();
  });

  test('pause in one tab updates the Play button in the other', async ({
    page,
    context,
  }) => {
    const page2 = await context.newPage();

    await page.goto('/');
    await page2.goto('/');

    await page
      .getByRole('listbox', { name: 'Podcast library' })
      .getByRole('option', { name: /Sync Podcast/ })
      .click();
    await page.getByRole('button', { name: 'Play episode' }).click();
    await expect(
      page.getByRole('button', { name: 'Pause', exact: true }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page2.getByRole('button', { name: 'Pause', exact: true }),
    ).toBeVisible({ timeout: 5000 });

    await page2.getByRole('button', { name: 'Pause', exact: true }).click();

    await expect(
      page.getByRole('button', { name: 'Play', exact: true }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page2.getByRole('button', { name: 'Play', exact: true }),
    ).toBeVisible({ timeout: 5000 });

    await page2.close();
  });

  test('episode marked played in one tab disappears from All Podcasts in the other', async ({
    page,
    context,
  }) => {
    const page2 = await context.newPage();

    await page.goto('/');
    await page2.goto('/');

    await expect(page.getByText('Sync Episode')).toBeVisible();
    await expect(page2.getByText('Sync Episode')).toBeVisible();

    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByText('Mark as played').click();

    await expect(page.getByText('Sync Episode')).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page2.getByText('Sync Episode')).not.toBeVisible({
      timeout: 5000,
    });

    await page2.close();
  });
});
