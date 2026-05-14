type SseClient = {
  controller: ReadableStreamDefaultController
  encoder: TextEncoder
}

const clients = new Set<SseClient>()

export function addSseClient(client: SseClient) {
  clients.add(client)
  return () => clients.delete(client)
}

export function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const client of clients) {
    try {
      client.controller.enqueue(client.encoder.encode(payload))
    } catch {
      clients.delete(client)
    }
  }
}
