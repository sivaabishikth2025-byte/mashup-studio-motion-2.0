import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd()),
  env: {
    FUSE_API_URL:
      process.env.FUSE_API_URL ||
      "https://1gp21rrv70.execute-api.us-east-1.amazonaws.com",
    VIDEO_API_URL: process.env.VIDEO_API_URL || "",
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.s3.amazonaws.com" },
      { protocol: "https", hostname: "*.s3.us-east-1.amazonaws.com" },
      { protocol: "https", hostname: "s3.us-east-1.amazonaws.com" },
      { protocol: "https", hostname: "*.cloudfront.net" },
      { protocol: "https", hostname: "d*.cloudfront.net" },
    ],
  },
};

export default nextConfig;
