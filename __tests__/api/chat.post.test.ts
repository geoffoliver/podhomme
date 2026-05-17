jest.mock('@/lib/sse', () => ({ broadcast: jest.fn() }));

import { POST } from '@/app/api/chat/route';
import { db } from '@/lib/db';
import { broadcast } from '@/lib/sse';

const mockBroadcast = broadcast as jest.MockedFunction<typeof broadcast>;

function post(body: unknown) {
  return POST(new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  mockBroadcast.mockClear();
});

describe('POST /api/chat', () => {
  // ── validation ───────────────────────────────────────────────────────────────

  it('returns 400 when author is missing', async () => {
    const res = await post({ message: 'Hello' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when author is empty', async () => {
    const res = await post({ author: '  ', message: 'Hello' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when author exceeds 50 characters', async () => {
    const res = await post({ author: 'A'.repeat(51), message: 'Hello' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when message is missing', async () => {
    const res = await post({ author: 'Alice' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when message is empty', async () => {
    const res = await post({ author: 'Alice', message: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when message exceeds 500 characters', async () => {
    const res = await post({ author: 'Alice', message: 'A'.repeat(501) });
    expect(res.status).toBe(400);
  });

  // ── success ──────────────────────────────────────────────────────────────────

  it('returns 201 with the created message', async () => {
    const res = await post({ author: 'Alice', message: 'Hello!' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ author: 'Alice', message: 'Hello!' });
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('sentAt');
  });

  it('saves the message to the database', async () => {
    await post({ author: 'Alice', message: 'Hello!' });
    const msg = await db.chatMessage.findFirst();
    expect(msg?.author).toBe('Alice');
    expect(msg?.message).toBe('Hello!');
  });

  it('broadcasts a chat event', async () => {
    await post({ author: 'Alice', message: 'Hello!' });
    expect(mockBroadcast).toHaveBeenCalledWith('chat', expect.objectContaining({
      author: 'Alice',
      message: 'Hello!',
    }));
  });

  it('trims whitespace from author and message', async () => {
    await post({ author: '  Alice  ', message: '  Hello!  ' });
    const msg = await db.chatMessage.findFirst();
    expect(msg?.author).toBe('Alice');
    expect(msg?.message).toBe('Hello!');
  });

  // ── pruning ──────────────────────────────────────────────────────────────────

  it('prunes messages beyond 50 after inserting', async () => {
    for (let i = 0; i < 50; i++) {
      await db.chatMessage.create({ data: { author: 'Alice', message: `old ${i}` } });
    }
    await post({ author: 'Bob', message: 'New one' });
    expect(await db.chatMessage.count()).toBe(50);
  });

  it('keeps the most recent messages when pruning', async () => {
    for (let i = 0; i < 50; i++) {
      await db.chatMessage.create({ data: { author: 'Alice', message: `old ${i}` } });
    }
    await post({ author: 'Bob', message: 'New one' });
    const newest = await db.chatMessage.findFirst({ orderBy: { id: 'desc' } });
    expect(newest?.message).toBe('New one');
    const oldest = await db.chatMessage.findFirst({ orderBy: { id: 'asc' } });
    expect(oldest?.message).toBe('old 1');
  });
});
