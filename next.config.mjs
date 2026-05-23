/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.openstreetmap.org" },
      { protocol: "https", hostname: "**.arcgisonline.com" },
      { protocol: "https", hostname: "server.arcgisonline.com" },
      { protocol: "https", hostname: "**.basemaps.cartocdn.com" }
    ]
  },
  // Exclut les snapshots backfill (~300 MB) du bundle serverless ;
  // ils sont chargés à chaud depuis raw.githubusercontent.com.
  experimental: {
    outputFileTracingExcludes: {
      "*": [
        "data/backfill/**",
        "**/data/backfill/**",
        "data/analytics/**",
        "**/data/analytics/**"
      ]
    }
  },
  webpack: (config, { webpack: wp, isServer }) => {
    if (!isServer) {
      // Strip the "node:" prefix so webpack can resolve them as regular modules
      // and then stub them out via resolve.fallback
      config.plugins.push(
        new wp.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        })
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        os: false,
        path: false,
        "image-size": false,
      };
    }
    return config;
  },
};

export default nextConfig;
