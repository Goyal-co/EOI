import { after } from "next/server";

/**
 * Schedule work after the HTTP response is sent (Next.js `after`).
 * Falls back to fire-and-forget if `after` is unavailable.
 */
export function deferWork(label: string, work: () => Promise<void>) {
  const run = async () => {
    try {
      await work();
    } catch (error) {
      console.error(`[defer:${label}]`, error);
    }
  };

  try {
    after(run);
  } catch {
    void run();
  }
}
