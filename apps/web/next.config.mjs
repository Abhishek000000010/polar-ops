/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@polar-ops/shared'],
  async rewrites() {
    const defaultBackend = process.env.NODE_ENV === 'development'
      ? 'http://localhost:4000'
      : 'https://polar-ops-api.onrender.com';
    const rawBackend = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || defaultBackend;
    const backendUrl = rawBackend.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`
      }
    ];
  }
};

export default nextConfig;
