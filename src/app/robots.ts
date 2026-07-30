import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { isNonProductionEnv } from "@/lib/env";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers();
  const host = headersList.get("host");

  if (isNonProductionEnv(host)) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://onpro.tech/sitemap.xml",
  };
}
