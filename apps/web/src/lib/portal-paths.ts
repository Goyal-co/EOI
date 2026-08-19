"use client";

/** Path helper for host-based portals; falls back to the given path on path-based routing. */
export function publicPortalPath(path: string): string {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}
