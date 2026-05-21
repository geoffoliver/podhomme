import { USER_AGENT } from '@/lib/user-agent';
import iTunes from '@/lib/itunes';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeJsonResponse(body: unknown) {
  return { ok: true, json: jest.fn().mockResolvedValue(body) };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('iTunes — user agent', () => {
  it('sends User-Agent when searching podcasts', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ results: [] }));
    const client = new iTunes();
    await client.searchPodcasts('test');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('search'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'User-Agent': USER_AGENT }),
      }),
    );
  });

  it('sends User-Agent when looking up a podcast', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ results: [] }));
    const client = new iTunes();
    await client.lookupPodcast(12345);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('lookup'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'User-Agent': USER_AGENT }),
      }),
    );
  });
});
