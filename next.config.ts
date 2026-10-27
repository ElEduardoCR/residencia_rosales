import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fija la raíz del proyecto (hay otro lockfile en el home del usuario).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
