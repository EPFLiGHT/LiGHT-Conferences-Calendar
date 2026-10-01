/** @type {import('next').NextConfig} */
// GitHub Pages serves a static export (its workflow moves src/app/api aside);
// Vercel serves the API routes.
const nextConfig = {
  images: {
    unoptimized: true,
  },
}

export default nextConfig
