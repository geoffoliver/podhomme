'use client';

import type {
  Episode, Podcast, QueueItem, RefreshStatus, SelectedView,
} from '@/types';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';
import { useSse } from './SseContext';

type State = {
  podcasts: Podcast[]
  queue: QueueItem[]
  selectedView: SelectedView
  refreshStatus: RefreshStatus | null
}

type Action =
  | { type: 'SET_PODCASTS'; payload: Podcast[] }
  | { type: 'SET_QUEUE'; payload: QueueItem[] }
  | { type: 'UPSERT_PODCAST'; payload: Podcast }
  | { type: 'DELETE_PODCAST'; payload: number }
  | { type: 'UPDATE_EPISODE'; payload: Episode }
  | { type: 'SET_VIEW'; payload: SelectedView }
  | { type: 'SET_REFRESH'; payload: RefreshStatus | null }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PODCASTS':
      return { ...state, podcasts: action.payload };
    case 'SET_QUEUE':
      return { ...state, queue: action.payload };
    case 'UPSERT_PODCAST': {
      const exists = state.podcasts.some(p => p.id === action.payload.id);
      return {
        ...state,
        podcasts: exists
          ? state.podcasts.map(p => p.id === action.payload.id ? action.payload : p)
          : [...state.podcasts, action.payload].sort((a, b) => a.title.localeCompare(b.title)),
      };
    }
    case 'DELETE_PODCAST':
      return {
        ...state,
        podcasts: state.podcasts.filter(p => p.id !== action.payload),
        selectedView: state.selectedView === action.payload ? 'all' : state.selectedView,
      };
    case 'UPDATE_EPISODE':
      return {
        ...state,
        queue: state.queue.filter(qi => {
          if (qi.episodeId !== action.payload.id) return true;
          return !action.payload.played;
        }),
      };
    case 'SET_VIEW':
      return { ...state, selectedView: action.payload };
    case 'SET_REFRESH':
      return { ...state, refreshStatus: action.payload };
    default:
      return state;
  }
}

type Ctx = {
  podcasts: Podcast[]
  queue: QueueItem[]
  selectedView: SelectedView
  refreshStatus: RefreshStatus | null
  setSelectedView: (view: SelectedView) => void
  refreshQueue: () => void
  refreshPodcasts: () => void
}

export const PodcastsContext = createContext<Ctx | null>(null);

export function PodcastsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    podcasts: [],
    queue: [],
    selectedView: 'all',
    refreshStatus: null,
  });

  const fetchPodcasts = useCallback(() =>
    fetch('/api/podcasts')
      .then(r => r.json())
      .then((data: Podcast[]) => dispatch({ type: 'SET_PODCASTS', payload: data })),
    [],
  );

  const fetchQueue = useCallback(() =>
    fetch('/api/queue')
      .then(r => r.json())
      .then((data: QueueItem[]) => dispatch({ type: 'SET_QUEUE', payload: data })),
    [],
  );

  useEffect(() => {
    fetchPodcasts();
    fetchQueue();
  }, [fetchPodcasts, fetchQueue]);

  useSse((event, data) => {
    if (event === 'podcast') {
      const p = data as Podcast & { deleted?: boolean };
      if (p.deleted) {
        dispatch({ type: 'DELETE_PODCAST', payload: p.id });
        fetchQueue();
      } else {
        dispatch({ type: 'UPSERT_PODCAST', payload: p });
        fetchQueue();
      }
    }
    if (event === 'episode') {
      dispatch({ type: 'UPDATE_EPISODE', payload: data as Episode });
    }
    if (event === 'queue') {
      fetchQueue();
    }
    if (event === 'refresh') {
      const r = data as RefreshStatus;
      dispatch({ type: 'SET_REFRESH', payload: r.done ? null : r });
      if (r.done) fetchPodcasts();
    }
  });

  const setSelectedView = useCallback((view: SelectedView) =>
    dispatch({ type: 'SET_VIEW', payload: view }), []);

  return (
    <PodcastsContext.Provider value={{
      podcasts: state.podcasts,
      queue: state.queue,
      selectedView: state.selectedView,
      refreshStatus: state.refreshStatus,
      setSelectedView,
      refreshQueue: fetchQueue,
      refreshPodcasts: fetchPodcasts,
    }}>
      {children}
    </PodcastsContext.Provider>
  );
}

export function usePodcasts() {
  const ctx = useContext(PodcastsContext);
  if (!ctx) throw new Error('usePodcasts must be used within PodcastsProvider');
  return ctx;
}
