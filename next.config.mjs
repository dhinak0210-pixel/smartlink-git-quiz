/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Prevents duplicate anti-cheat listeners triggering in strict dev mode
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, x-session-token' },
        ],
      },
      {
        source: '/api/event/status',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=1, stale-while-revalidate=2' },
        ],
      },
    ];
  },
};

export default nextConfig;
