import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site';

const ENTRIES = [
  { path: '/', priority: 1 },
  { path: '/sign-in', priority: 0.5 },
  { path: '/sign-up', priority: 0.5 },
] as const;

// No `lastModified`: the output stays deterministic for a prerendered route.
export default function sitemap(): MetadataRoute.Sitemap {
  return ENTRIES.map(({ path, priority }) => ({
    url: `${siteUrl()}${path}`,
    changeFrequency: 'monthly',
    priority,
  }));
}
