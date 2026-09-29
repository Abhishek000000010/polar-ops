/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@polar-ops/shared'],
  async rewrites() {
    let backendUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://polar-ops-api.onrender.com';
    backendUrl = backendUrl.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');

    // Handle bare service names (e.g. 'polar-ops-api') or missing protocols from cloud hosts
    if (backendUrl === 'polar-ops-api' || !backendUrl.includes('.')) {
      backendUrl = 'https://polar-ops-api.onrender.com';
    } else if (!backendUrl.startsWith('http://') && !backendUrl.startsWith('https://')) {
      backendUrl = `https://${backendUrl}`;
    }

    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`
      }
    ];
  }
};

export default nextConfig;
