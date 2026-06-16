const CHUNK_RELOAD_KEY = "goyal_chunk_reload";

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";
  return (
    name === "ChunkLoadError"
    || message.includes("Loading chunk")
    || message.includes("Failed to fetch dynamically imported module")
  );
}

export function reloadOnceForChunkError(): boolean {
  if (typeof window === "undefined") return false;
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return false;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  window.location.reload();
  return true;
}

export function clearChunkReloadFlag(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
}
