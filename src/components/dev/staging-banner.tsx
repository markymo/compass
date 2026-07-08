"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

export function StagingBanner() {
  const [envType, setEnvType] = useState<"staging" | "dev" | null>(null);

  useEffect(() => {
    const env = process.env.NEXT_PUBLIC_APP_ENV;
    const hostname = window.location.hostname;
    
    let detectedEnv: "staging" | "dev" | null = null;
    
    if (env === "dev" || hostname.includes("localhost") || hostname.includes("127.0.0.1")) {
      detectedEnv = "dev";
    } else if (env === "staging" || hostname.includes("dev.onpro.tech") || hostname.includes("staging")) {
      detectedEnv = "staging";
    }
    
    if (detectedEnv) {
      setEnvType(detectedEnv);
      
      const iconSuffix = detectedEnv === "dev" ? "-dev" : "-staging";
      
      // Function to enforce the favicon
      const enforceFavicon = () => {
        const cacheBuster = `?v=${Date.now()}`;
        const targetHref = `/icon${iconSuffix}.svg${cacheBuster}`;
        
        let hasCorrectIcon = false;
        
        document.querySelectorAll("link[rel~='icon'], link[rel='shortcut icon']").forEach(link => {
          const l = link as HTMLLinkElement;
          if (l.href.includes(`/icon${iconSuffix}.svg`)) {
            hasCorrectIcon = true;
          } else {
            // Safely mutate href instead of calling link.remove(), 
            // which breaks React's node.parentNode.removeChild(node) on unmount
            l.href = targetHref;
            hasCorrectIcon = true;
          }
        });

        if (!hasCorrectIcon) {
          const newIcon = document.createElement('link');
          newIcon.rel = 'shortcut icon';
          newIcon.href = targetHref;
          newIcon.type = 'image/svg+xml';
          document.head.appendChild(newIcon);
        }
      };

      // Function to swap logos
      const swapLogos = () => {
        document.querySelectorAll('img[src="/logo.svg"], img[src^="/logo.svg?"]').forEach(img => {
          (img as HTMLImageElement).src = `/logo${iconSuffix}.svg`;
        });
        document.querySelectorAll('img[src="/logo-inverted.svg"], img[src^="/logo-inverted.svg?"]').forEach(img => {
          (img as HTMLImageElement).src = `/logo-inverted${iconSuffix}.svg`;
        });
      };

      // Initial swap
      enforceFavicon();
      swapLogos();

      // Set up a MutationObserver to catch any logos/head tags rendered after initial load
      const observer = new MutationObserver(() => {
        swapLogos();
        enforceFavicon();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });

      return () => observer.disconnect();
    }
  }, []);

  if (!envType) return null;

  return (
    <div className={`px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 z-[9999] relative w-full shadow-sm ${envType === 'dev' ? 'bg-green-600 text-white' : 'bg-purple-600 text-white'}`}>
      <AlertTriangle className="w-4 h-4" />
      <span className="tracking-wide uppercase">
        {envType === 'dev' 
          ? "Local Development Environment"
          : "Staging Environment - Changes here will not affect live production data"
        }
      </span>
      <AlertTriangle className="w-4 h-4" />
    </div>
  );
}
