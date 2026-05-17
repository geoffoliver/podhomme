import { iTunesData } from '@/types';
import { USER_AGENT } from '@/lib/user-agent';

class iTunes {
  baseUrl = 'https://itunes.apple.com/';

  async searchPodcasts(term: string): Promise<iTunesData> {
    const url = `${this.baseUrl}/search?media=podcast&entity=podcast&term=${term}&limit=200`;
    return this.fetch(url);
  }

  async lookupPodcast(id: number): Promise<iTunesData> {
    const url = `${this.baseUrl}/lookup?entity=podcast&id=${id}`;
    return this.fetch(url);
  }

  private async fetch(url: string): Promise<iTunesData> {
    const result = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    return result.json() as Promise<iTunesData>;
  }
}

export default iTunes;
