import { addSseClient } from '@/lib/sse';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const remove = addSseClient({ controller, encoder });

      // Send initial ping so the client knows the connection is live
      controller.enqueue(encoder.encode('event: connected\ndata: {}\n\n'));

      // Heartbeat every 30s to keep the connection alive
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(interval);
        }
      }, 30_000);

      return () => {
        clearInterval(interval);
        remove();
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
