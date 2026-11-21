import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  async rewrites() { return [{source:'/shadowing/media',destination:'/api/shadowing-media'}]; },
  webpack(webpackConfig, { isServer, nextRuntime }) {
    if (!isServer && nextRuntime !== 'edge') {
      const splitChunks = webpackConfig.optimization?.splitChunks;
      if (splitChunks && typeof splitChunks === 'object') {
        splitChunks.cacheGroups = {
          ...splitChunks.cacheGroups,
          sharedComponents: {
            test: /[\\/]src[\\/]components[\\/].*\.[cm]?[jt]sx?$/,
            minChunks: 2,
            minSize: 0,
            priority: 25,
            reuseExistingChunk: true,
          },
        };
      }
    }
    return webpackConfig;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};
export default config;
