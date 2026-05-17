import { db } from '@/lib/db';
import { buildOpml } from '@/lib/feed';

export async function GET() {
  const podcasts = await db.podcast.findMany({
    orderBy: { title: 'asc' },
    select: { title: true, feedUrl: true, siteUrl: true },
  });

  const xml = buildOpml(podcasts);

  return new Response(xml, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Disposition': 'attachment; filename="podhomme.opml"',
    },
  });
}
