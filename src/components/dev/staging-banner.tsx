"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

export function StagingBanner() {
  const [isStaging, setIsStaging] = useState(false);

  useEffect(() => {
    const env = process.env.NEXT_PUBLIC_APP_ENV;
    const isStagingDomain = window.location.hostname.includes("dev.onpro.tech") || window.location.hostname.includes("staging") || window.location.hostname.includes("localhost");
    
    if (env === "staging" || isStagingDomain) {
      setIsStaging(true);
      
      // Update the favicon dynamically for staging tabs
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = '/icon-staging.svg';

      // Function to swap logos
      const swapLogos = () => {
        document.querySelectorAll('img[src="/logo.svg"], img[src^="/logo.svg?"]').forEach(img => {
          (img as HTMLImageElement).src = '/logo-staging.svg';
        });
        document.querySelectorAll('img[src="/logo-inverted.svg"], img[src^="/logo-inverted.svg?"]').forEach(img => {
          (img as HTMLImageElement).src = '/logo-inverted-staging.svg';
        });
      };

      // Initial swap
      swapLogos();

      // Set up a MutationObserver to catch any logos rendered after initial load (e.g. Next.js navigations)
      const observer = new MutationObserver(() => {
        swapLogos();
      });
      observer.observe(document.body, { childList: true, subtree: true });

      return () => observer.disconnect();
    }
  }, []);

  if (!isStaging) return null;

  return (
    <div className="bg-purple-600 text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 z-[9999] relative w-full shadow-sm">
      <AlertTriangle className="w-4 h-4" />
      <span className="tracking-wide uppercase">
        Staging Environment - Changes here will not affect live production data
      </span>
      <AlertTriangle className="w-4 h-4" />
    </div>
  );
}
