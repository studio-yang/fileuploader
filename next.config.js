const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack: (config, { isServer }) => {
    // 7z-wasm 是 browser-only，把 Node 內建模組 fallback 掉
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        module: false,
        fs:     false,
        path:   false,
        crypto: false,
      };
    }
    config.experiments = { ...(config.experiments || {}), asyncWebAssembly: true };
    return config;
  },
  async headers() {
    return [
      {
        // API CORS（Koyeb/自架平台不吃 vercel.json，需在此宣告）
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,x-file-name,x-content-type,x-file-size' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' cdn.jsdelivr.net lottie.host; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' api.brevo.com https:; font-src 'self' data:; base-uri 'self'; form-action 'self';"
          },
        ],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
