import { broadcast } from '@/lib/sse';
import { db } from '@/lib/db';

const MAX_MESSAGES = 50;
const MAX_AUTHOR_LEN = 50;
const MAX_MESSAGE_LEN = 500;

export async function GET() {
  const total = await db.chatMessage.count();
  const messages = await db.chatMessage.findMany({
    orderBy: { id: 'asc' },
    take: MAX_MESSAGES,
    skip: Math.max(0, total - MAX_MESSAGES),
  });
  return Response.json(messages);
}

export async function POST(request: Request) {
  const body = await request.json();

  const author = typeof body.author === 'string' ? body.author.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!author || author.length > MAX_AUTHOR_LEN) {
    return Response.json(
      { error: 'Author is required and must be 50 characters or fewer' },
      { status: 400 },
    );
  }
  if (!message || message.length > MAX_MESSAGE_LEN) {
    return Response.json(
      { error: 'Message is required and must be 500 characters or fewer' },
      { status: 400 },
    );
  }

  const msg = await db.chatMessage.create({ data: { author, message } });

  broadcast('chat', msg);

  const count = await db.chatMessage.count();
  if (count > MAX_MESSAGES) {
    const oldest = await db.chatMessage.findMany({
      orderBy: { id: 'asc' },
      take: count - MAX_MESSAGES,
      select: { id: true },
    });
    await db.chatMessage.deleteMany({
      where: { id: { in: oldest.map((m) => m.id) } },
    });
  }

  return Response.json(msg, { status: 201 });
}
