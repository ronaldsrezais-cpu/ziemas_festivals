import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/template": ["./assets/accreditation/*.jpg"],
  },
};

export default nextConfig;
