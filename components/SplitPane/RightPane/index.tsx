'use client'

import { usePodcasts } from '@/context/PodcastsContext'
import { AllPodcastsView } from './AllPodcastsView'
import { FavoritesView } from './FavoritesView'
import { PodcastView } from './PodcastView'
import styles from './index.module.css'

export function RightPane() {
  const { selectedView } = usePodcasts()

  return (
    <main className={styles.pane}>
      {selectedView === 'all' && <AllPodcastsView />}
      {selectedView === 'favorites' && <FavoritesView />}
      {typeof selectedView === 'number' && <PodcastView podcastId={selectedView} />}
    </main>
  )
}
