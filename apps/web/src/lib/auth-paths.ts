/** Auth pages that must not render the dashboard shell. */
export function isShellAuthPath(pathname: string, prefixes: string[]): boolean {
  const paths = new Set<string>();
  for (const prefix of prefixes) {
    paths.add(prefix);
    const short = prefix.replace(/^\/(customer|partner|admin)(?=\/|$)/, "");
    if (short && short !== prefix) paths.add(short || "/");
  }
  return [...paths].some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
