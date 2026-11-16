import type { Metadata, Viewport } from 'next';
import './globals.css';
import '../components/motion/motion.css';
import { connection } from 'next/server';
import { vietnamClock } from '../core/day-period.ts';
import { TimeProvider } from '../components/time-provider.tsx';
import { getAppearance } from '../server/preferences.ts';
export const metadata: Metadata = {
  title: { default: 'Nihon Nihon', template: '%s · Nihon Nihon' },
  description: 'Không gian học tiếng Nhật riêng tư.',
  robots: { index: false, follow: false, nocache: true },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F7F6F1',
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const { period } = vietnamClock();
  const appearance = getAppearance();
  return (
    <html lang="vi" data-time={period} data-theme={appearance.theme} data-motion={appearance.motion ? 'on' : 'off'}>
      <body><TimeProvider period={period} />{children}</body>
    </html>
  );
}
