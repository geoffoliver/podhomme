import { db } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const podcastId = searchParams.get('podcastId');
  const favorited = searchParams.get('favorited');
  const unplayed = searchParams.get('unplayed');

  const episodes = await db.episode.findMany({
    where: {
      ...(podcastId ? { podcastId: Number(podcastId) } : {}),
      ...(favorited === 'true' ? { favorited: true } : {}),
      ...(unplayed === 'true' ? { played: false } : {}),
    },
    orderBy: { pubDate: 'desc' },
    include: {
 podcast: {
 select: {
 title: true, imageUrl: true, author: true, 
}, 
}, 
},
  });
  return Response.json(episodes);
}
