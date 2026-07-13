import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    // NOTE: keep true until a local `tsc --noEmit` passes cleanly. The
    // pdfjs-dist v3 runtime vs @types/pdfjs-dist v2 mismatch (see transcript.ts)
    // must be resolved before flipping this to false.
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: 'export',
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
      encoding: false,
    };

    config.module = {
      ...config.module,
      rules: [
        ...config.module.rules,
        {
          test: /pdf\.worker\.(min\.)?js/,
          type: 'asset/resource',
          generator: {
            filename: 'static/chunks/[name].[hash][ext]'
          }
        }
      ]
    };

    if (isServer) {
      config.externals.push({
        canvas: 'commonjs canvas',
      });
    }

    return config;
  }
};

export default nextConfig;
