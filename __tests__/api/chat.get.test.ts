import { GET } from '@/app/api/chat/route';
import { db } from '@/lib/db';

describe('GET /api/chat', () => {
  it('returns 200 with an empty array when no messages exist', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('returns messages in chronological order (oldest first)', async () => {
    await db.chatMessage.create({
      data: { author: 'Alice', message: 'First' },
    });
    await db.chatMessage.create({ data: { author: 'Bob', message: 'Second' } });

    const messages = await (await GET()).json();
    expect(messages[0].message).toBe('First');
    expect(messages[1].message).toBe('Second');
  });

  it('returns at most 50 messages', async () => {
    for (let i = 0; i < 60; i++) {
      await db.chatMessage.create({
        data: { author: 'Alice', message: `msg ${i}` },
      });
    }
    const messages = await (await GET()).json();
    expect(messages.length).toBe(50);
  });

  it('returns the 50 most recent messages when there are more than 50', async () => {
    for (let i = 0; i < 60; i++) {
      await db.chatMessage.create({
        data: { author: 'Alice', message: `msg ${i}` },
      });
    }
    const messages = await (await GET()).json();
    expect(messages[0].message).toBe('msg 10');
    expect(messages[49].message).toBe('msg 59');
  });

  it('includes id, author, message, and sentAt fields', async () => {
    await db.chatMessage.create({
      data: { author: 'Alice', message: 'Hello' },
    });
    const [msg] = await (await GET()).json();
    expect(msg).toHaveProperty('id');
    expect(msg).toHaveProperty('author', 'Alice');
    expect(msg).toHaveProperty('message', 'Hello');
    expect(msg).toHaveProperty('sentAt');
  });
});
