import type { Metadata, Viewport } from 'next';
import './globals.css';
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
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
