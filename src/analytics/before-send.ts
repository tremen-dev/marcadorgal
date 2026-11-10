/**
 * SPEC-077 CA-2 (ADR-033 §3): the filter every Web Analytics event goes
 * through before it leaves the browser. Pure: the caller passes what it reads
 * from `navigator`.
 */

export interface AnalyticsEvent {
  readonly type: "pageview" | "event";
  readonly url: string;
}

export interface BrowserFacts {
  /** `navigator.webdriver`: true in Playwright, so our probes never count. */
  readonly webdriver: boolean;
}

/** Routes that are not part of the public site. */
const NON_PUBLIC = ["/api", "/demo", "/es/demo"] as const;

const BASE = "http://relative.invalid";

export function beforeSend<E extends AnalyticsEvent>(
  event: E,
  { webdriver }: BrowserFacts,
): E | null {
  if (webdriver) return null;
  const absolute = /^[a-z][a-z0-9+.-]*:/i.test(event.url);
  const url = new URL(event.url, BASE);
  if (
    NON_PUBLIC.some(
      (prefix) =>
        url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
    )
  )
    return null;
  const kept = new URLSearchParams();
  for (const [key, value] of url.searchParams)
    if (key.startsWith("utm_")) kept.append(key, value);
  const query = kept.size > 0 ? `?${kept.toString()}` : "";
  const prefix = absolute ? url.origin : "";
  return { ...event, url: `${prefix}${url.pathname}${query}` };
}
