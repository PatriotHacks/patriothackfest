import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/supabase", "@workspace/ui"],
}

export default nextConfig
