import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignore TypeScript and ESLint errors during build
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Image optimization
  images: {
    domains: [
      'res.cloudinary.com',
      'localhost',
      'firebasestorage.googleapis.com',
      'lh3.googleusercontent.com',
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  
  // Environment variables
  env: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  },
  
  // For React 19 compatibility
  reactStrictMode: true,
  
  // Optional: For API route proxying
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },
  
  // Optional: Output configuration
  output: 'standalone', // For Docker deployments
  
  // Optional: Disable powered by header
  poweredByHeader: false,
};

export default nextConfig;