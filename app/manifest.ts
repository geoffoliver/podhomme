import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Podhomme',
    short_name: 'Podhomme',
    description: 'Shared podcast player',
    start_url: process.env.WEB_URL ?? 'http://localhost:3000',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#000',
    theme_color: '#000',
    // icons: [
    //   {
    //     src: '/favicon.ico',
    //     sizes: 'any',
    //     type: 'image/x-icon',
    //   },
    //   {
    //     src: '/apple-touch-icon.png',
    //     sizes: 'any',
    //     type: 'image/png',
    //   },
    // ],
  };
};
