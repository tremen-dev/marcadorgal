"use client";

import { Analytics } from "@vercel/analytics/next";
import { beforeSend } from "./before-send";

/**
 * SPEC-077 CA-1, CA-2: Vercel Web Analytics (ADR-033) with our filter. Only
 * SiteAnalytics mounts it, and only in Production; `mode` is forced so the
 * script is the production one (same origin, no debug script from a CDN).
 */
export function MeasuredAnalytics() {
  return (
    <Analytics
      mode="production"
      beforeSend={(event) =>
        beforeSend(event, { webdriver: navigator.webdriver === true })
      }
    />
  );
}
