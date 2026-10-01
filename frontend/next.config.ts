import type { NextConfig } from "next";

const backendOrigin =
  process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8080";

const nextConfig: NextConfig = {
  output: "standalone",
  // Rewrite /api/backend/* diproksi lewat server Next. Default timeout proxy
  // undici = 30 detik, jadi upload backup besar (restore ZIP, lampiran) mati
  // dengan "Internal Server Error" sebelum backend selesai membaca body.
  experimental: {
    // Rewrite /api/backend/* diproksi lewat server Next. Dua batas default yang
    // bikin restore backup gagal sejak ukuran sedang:
    //  - proxyClientMaxBodySize 10MB: body dipotong 10MB, sisa request menggantung
    //    sampai timeout → browser dapat teks "Internal Server Error".
    //  - proxyTimeout 30 detik.
    proxyClientMaxBodySize: 512 * 1024 * 1024,
    proxyTimeout: 10 * 60 * 1000,
  },
  // Jangan bocorkan stack via header X-Powered-By (fingerprint Wappalyzer dkk).
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            // camera=(self) wajib: absensi memakai webcam (webcam-capture.tsx).
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "9000",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendOrigin}/:path*`,
      },
      {
        source: "/storage/:path*",
        destination: `${backendOrigin}/storage/:path*`,
      },
    ];
  },
};

export default nextConfig;
