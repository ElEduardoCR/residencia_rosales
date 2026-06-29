import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fija la raíz del proyecto (hay otro lockfile en el home del usuario).
  turbopack: {
    root: __dirname,
  },
  // El chequeo de tipos se ejecuta aparte (npm run typecheck). Evita que el
  // build de Vercel falle/cuelgue por el verificador de tipos integrado.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
