/** Keep the UI and server on the same explicitly opted-in, non-production policy. */
export function isDevDemoEnabled(): boolean {
  return process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_ENABLE_DEV_DEMO_ACCOUNT === "true";
}
