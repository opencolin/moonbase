import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The demo database is a plain file, so Next's dependency tracing has no
   * way to know the server needs it. Name it explicitly or the deployed
   * functions come up with no database at all. See db/index.ts.
   */
  outputFileTracingIncludes: {
    "/**/*": ["./luma.db"],
  },
};

export default nextConfig;
