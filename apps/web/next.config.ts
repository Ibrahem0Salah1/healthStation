import type { NextConfig } from "next";
import path from 'node:path';
const nextConfig: NextConfig = {
  // Point Turbopack at the MONOREPO root, not apps/web.
  // pnpm installs every package physically under <root>/node_modules/.pnpm,
  // so both `next` and `@repo/database` resolve to paths above apps/web.
  // Turbopack only compiles files inside its root, so without this it
  // cannot find either one.
  turbopack: {
    root: path.join(__dirname, "../../"),
  },
  transpilePackages: ['@repo/database']
};


export default nextConfig;
