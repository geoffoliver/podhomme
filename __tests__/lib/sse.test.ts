import { addSseClient, broadcast } from '@/lib/sse';

function makeClient() {
  const encoded: Uint8Array[] = [];
  const controller = {
    enqueue: jest.fn((chunk: Uint8Array) => encoded.push(chunk)),
  } as unknown as ReadableStreamDefaultController;
  const encoder = new TextEncoder();
  return { controller, encoder, encoded };
}

// ─── addSseClient ─────────────────────────────────────────────────────────────

describe('addSseClient', () => {
  it('returns a cleanup function that removes the client', () => {
    const client = makeClient();
    const remove = addSseClient(client);

    broadcast('ping', {});
    expect(client.controller.enqueue).toHaveBeenCalledTimes(1);

    remove();
    broadcast('ping', {});
    expect(client.controller.enqueue).toHaveBeenCalledTimes(1); // not called again
  });
});

// ─── broadcast ────────────────────────────────────────────────────────────────

describe('broadcast', () => {
  it('sends the correct SSE frame to each connected client', () => {
    const client = makeClient();
    const remove = addSseClient(client);

    broadcast('episode', { id: 42, played: true });

    const text = new TextDecoder().decode(client.encoded[0]);
    expect(text).toBe('event: episode\ndata: {"id":42,"played":true}\n\n');

    remove();
  });

  it('sends to multiple clients', () => {
    const a = makeClient();
    const b = makeClient();
    const removeA = addSseClient(a);
    const removeB = addSseClient(b);

    broadcast('queue', null);

    expect(a.controller.enqueue).toHaveBeenCalledTimes(1);
    expect(b.controller.enqueue).toHaveBeenCalledTimes(1);

    removeA();
    removeB();
  });

  it('removes a client whose controller throws and continues to other clients', () => {
    const bad = makeClient();
    (bad.controller.enqueue as jest.Mock).mockImplementationOnce(() => {
      throw new Error('stream closed');
    });
    const good = makeClient();

    const removeBad = addSseClient(bad);
    const removeGood = addSseClient(good);

    broadcast('playback', {});

    // bad client was removed; good client still received the message
    expect(good.controller.enqueue).toHaveBeenCalledTimes(1);

    // bad client should no longer receive future broadcasts
    broadcast('playback', {});
    expect(bad.controller.enqueue).toHaveBeenCalledTimes(1); // only the one failed attempt

    removeGood();
  });
});
