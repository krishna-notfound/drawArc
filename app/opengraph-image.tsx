import { ImageResponse } from 'next/og';

import { OG_THEME, SITE_NAME } from '@/lib/site';

export const alt = 'drawArc — real-time collaborative system-design canvas and whiteboard';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: 80,
          background: OG_THEME.background,
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 700, color: OG_THEME.brand }}>{SITE_NAME}</div>
        <div style={{ fontSize: 44, color: OG_THEME.text }}>
          Real-time collaborative system-design canvas and whiteboard
        </div>
      </div>
    ),
    size,
  );
}
