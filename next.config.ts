import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  ...(isGitHubPages
    ? {
        output: "export" as const,
        basePath: "/KhetOS",
        assetPrefix: "/KhetOS/",
        trailingSlash: true,
        images: { unoptimized: true },
        // The repository also contains a Cloudflare worker with platform-only
        // types; it is not part of the static GitHub Pages application.
        typescript: { ignoreBuildErrors: true },
      }
    : {}),
};

export default nextConfig;
