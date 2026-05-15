import type { NextConfig } from "next"

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@client-sites/ui", "@client-sites/email"],
  images: {
    remotePatterns: [
      // Zero Risk GPT Image wrapper output bucket
      {
        protocol: "https",
        hostname: "ordaeyxvvvdqsznsecjx.supabase.co",
        pathname: "/storage/v1/object/public/agent-images/**",
      },
    ],
  },
}

export default config
