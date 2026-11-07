import packageJson from "../../package.json";

export const APP_VERSION: string = packageJson.version;

/**
 * Returns the formatted application version string (e.g. "v0.1.0" or "v0.1.0·a1b2c3d").
 */
export function getAppVersionDisplay(): string {
  const commit =
    process.env.NEXT_PUBLIC_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    "";
  if (commit) {
    return `v${APP_VERSION}·${commit.slice(0, 7)}`;
  }
  return `v${APP_VERSION}`;
}
