import type { NextConfig } from "next";

const supabaseHostname = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null
  } catch {
    return null
  }
})()

const imageHostnames = new Set([
  'kjvcapmawmzmossumejm.supabase.co',
  ...(supabaseHostname ? [supabaseHostname] : []),
])

const nextConfig: NextConfig = {
  images: {
    remotePatterns: Array.from(imageHostnames, (hostname) => ({
        protocol: 'https',
        hostname,
        port: '',
        pathname: '/storage/v1/object/public/**',
      })),
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
