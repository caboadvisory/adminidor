import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // @react-pdf/renderer is a heavy Node library; don't bundle it.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default withNextIntl(nextConfig);
