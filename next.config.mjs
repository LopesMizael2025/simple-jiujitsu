/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // face-api tenta resolver módulos de Node no bundle do browser.
  // Como só rodamos no cliente, basta desligá-los.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        os: false,
        util: false,
        worker_threads: false,
      };
    }
    return config;
  },
};

export default nextConfig;
