import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: [
    "@workspace/email",
    "@workspace/forms",
    "@workspace/supabase",
    "@workspace/ui",
  ],
}

export default nextConfig
