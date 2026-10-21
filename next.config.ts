import type { NextConfig } from 'next';

import('@opennextjs/cloudflare').then(({ initOpenNextCloudflareForDev }) =>
  initOpenNextCloudflareForDev(),
);

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
