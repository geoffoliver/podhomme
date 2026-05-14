'use client'

import { createContext, useContext, useEffect, useRef } from 'react'

type SseListener = (event: string, data: unknown) => void

const SseContext = createContext<{ subscribe: (fn: SseListener) => () => void } | null>(null)

const SSE_EVENTS = ['connected', 'playback', 'episode', 'podcast', 'queue', 'refresh']

export function SseProvider({ children }: { children: React.ReactNode }) {
  const listeners = useRef<Set<SseListener>>(new Set())

  useEffect(() => {
    let es: EventSource
    let retryTimeout: ReturnType<typeof setTimeout>

    function connect() {
      es = new EventSource('/api/events')

      for (const evt of SSE_EVENTS) {
        es.addEventListener(evt, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data)
            listeners.current.forEach(fn => fn(evt, data))
          } catch (ex: unknown) {
            console.log(e.data);
            console.error('Error parsing SSE data', ex)
          }
        })
      }

      es.onerror = () => {
        es.close()
        retryTimeout = setTimeout(connect, 3000)
      }
    }

    connect()
    return () => {
      clearTimeout(retryTimeout)
      es?.close()
    }
  }, [])

  const subscribe = (fn: SseListener) => {
    listeners.current.add(fn)
    return () => listeners.current.delete(fn)
  }

  return <SseContext.Provider value={{ subscribe }}>{children}</SseContext.Provider>
}

export function useSse(listener: SseListener) {
  const ctx = useContext(SseContext)
  // Stable ref so subscribe/unsubscribe doesn't fire on every render
  const listenerRef = useRef(listener)
  listenerRef.current = listener

  useEffect(() => {
    if (!ctx) return
    return ctx.subscribe((evt, data) => listenerRef.current(evt, data))
  }, [ctx])
}
