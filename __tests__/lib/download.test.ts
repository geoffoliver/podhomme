jest.mock('@/lib/db', () => ({
  db: { episode: { update: jest.fn().mockResolvedValue({}) } },
}));
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { child: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }) },
}));
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

import { downloadEpisode } from '@/lib/download';
import { USER_AGENT } from '@/lib/user-agent';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeOkResponse(body = new ArrayBuffer(8)) {
  return {
    ok: true,
    status: 200,
    arrayBuffer: jest.fn().mockResolvedValue(body),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('downloadEpisode — user agent', () => {
  it('sends the User-Agent header when fetching audio', async () => {
    mockFetch.mockResolvedValue(makeOkResponse());
    await downloadEpisode(1, 'https://cdn.example.com/ep.mp3', '/tmp/downloads');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://cdn.example.com/ep.mp3',
      expect.objectContaining({
        headers: expect.objectContaining({ 'User-Agent': USER_AGENT }),
      }),
    );
  });

  it('does not re-enter if already in progress', async () => {
    // Hang the first fetch so the episode stays in-progress while we call again
    let resolve!: (v: unknown) => void;
    const hanging = new Promise((r) => { resolve = r; });
    mockFetch.mockReturnValueOnce(hanging);

    const first = downloadEpisode(1, 'https://cdn.example.com/ep.mp3', '/tmp/downloads');
    await downloadEpisode(1, 'https://cdn.example.com/ep.mp3', '/tmp/downloads');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    resolve({ ok: false }); // let the first call finish
    await first;
  });
});
