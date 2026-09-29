/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@polar-ops/shared'],
  async rewrites() {
    const backendUrl = process.env.API_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`
      }
    ];
  }
};

export default nextConfig;
