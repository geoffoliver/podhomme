export type PodcastMeta = {
  title: string
  imageUrl: string | null
  author: string | null
}

export type Episode = {
  id: number
  podcastId: number
  guid: string
  title: string
  description: string | null
  audioUrl: string
  imageUrl: string | null
  duration: number | null
  pubDate: string
  played: boolean
  playedAt: string | null
  favorited: boolean
  favoritedAt: string | null
  downloadPath: string | null
  fileSize: number | null
  createdAt: string
  podcast?: PodcastMeta
}

export type Podcast = {
  id: number
  title: string
  description: string | null
  imageUrl: string | null
  feedUrl: string
  siteUrl: string | null
  author: string | null
  type: string
  typeOverride: string | null
  createdAt: string
  updatedAt: string
  lastRefreshedAt: string | null
  episodes?: Episode[]
  _count?: { episodes: number }
}

export type QueueItem = {
  id: number
  episodeId: number
  position: number
  episode: Episode & { podcast: PodcastMeta & { type: string; typeOverride: string | null } }
}

export type PlaybackStateData = {
  id: number
  episodeId: number | null
  position: number
  isPlaying: boolean
  context: 'all' | 'podcast' | 'favorites'
  contextPodcastId: number | null
  updatedAt: string
  episode: (Episode & { podcast: PodcastMeta }) | null
}

export type Settings = {
  id: number
  refreshFrequency: number
  episodesToKeep: string
  defaultPlayback: string
  downloadLocation: string
}

export type RefreshStatus = {
  podcastTitle: string
  current: number
  total: number
  done: boolean
}

export type SelectedView = 'all' | 'favorites' | number
