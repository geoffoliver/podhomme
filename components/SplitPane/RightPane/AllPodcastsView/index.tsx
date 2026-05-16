'use client';

import {
  DragDropContext, Draggable, type DropResult, Droppable,
} from '@hello-pangea/dnd';
import { useEffect, useState } from 'react';
import { Inbox } from 'lucide-react';

import type { Episode, QueueItem } from '@/types';
import { EpisodeDetail } from '../EpisodeDetail';
import { EpisodeRow } from '../EpisodeRow';
import { usePodcasts } from '@/context/PodcastsContext';

import styles from './index.module.css';

type SortMode = 'manual' | 'asc' | 'desc'

export function AllPodcastsView() {
  const { queue, refreshQueue } = usePodcasts();
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [detailEpisode, setDetailEpisode] = useState<Episode | null>(null);
  const [localItems, setLocalItems] = useState<QueueItem[] | null>(null);

  // Once the server queue syncs back, drop the optimistic override
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLocalItems(null); }, [queue]);

  const sorted: QueueItem[] = [...queue].sort((a, b) => {
    if (sortMode === 'asc') return new Date(a.episode.pubDate).getTime() - new Date(b.episode.pubDate).getTime();
    if (sortMode === 'desc') return new Date(b.episode.pubDate).getTime() - new Date(a.episode.pubDate).getTime();
    return a.position - b.position;
  });

  const displayItems = localItems ?? sorted;

  const totalSeconds = queue.reduce((sum, item) => {
    const remaining = (item.episode.duration ?? 0) - Math.floor(item.episode.resumeAt ?? 0);
    return sum + Math.max(0, remaining);
  }, 0);
  const totalTime = (() => {
    if (totalSeconds === 0) return '';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `[${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}]`;
  })();

  async function handleDragEnd(result: DropResult) {
    if (!result.destination || result.destination.index === result.source.index) return;

    const items = Array.from(displayItems);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);

    setLocalItems(items);  // show new order immediately

    const updates = items.map((item, idx) => ({ id: item.id, position: idx }));
    await fetch('/api/queue', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    refreshQueue();
  }

  return (
    <div className={styles.view}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarTitle}>
          All Podcasts — Unplayed ({queue.length}){totalTime ? ` ${totalTime}` : ''}
        </span>
        <button
          className={`btn-ghost text-xs ${sortMode === 'asc' ? 'font-semibold' : ''}`}
          onClick={() => setSortMode(m => m === 'asc' ? 'manual' : 'asc')}
        >
          Oldest first
        </button>
        <button
          className={`btn-ghost text-xs ${sortMode === 'desc' ? 'font-semibold' : ''}`}
          onClick={() => setSortMode(m => m === 'desc' ? 'manual' : 'desc')}
        >
          Newest first
        </button>
      </div>

      {queue.length === 0 ? (
        <div className={styles.empty}>
          <Inbox size={32} />
          <span>No unplayed episodes</span>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="queue" isDropDisabled={sortMode !== 'manual'}>
            {(provided) => (
              <div
                className={styles.episodeList}
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {displayItems.map((item, index) => (
                  <Draggable
                    key={item.id}
                    draggableId={String(item.id)}
                    index={index}
                    isDragDisabled={sortMode !== 'manual'}
                  >
                    {(drag) => (
                      <div ref={drag.innerRef} {...drag.draggableProps}>
                        <EpisodeRow
                          episode={item.episode}
                          context="all"
                          onDetail={setDetailEpisode}
                          dragHandleProps={sortMode === 'manual' ? drag.dragHandleProps ?? undefined : undefined}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <EpisodeDetail episode={detailEpisode} onClose={() => setDetailEpisode(null)} />
    </div>
  );
}
