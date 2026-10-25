export const CHAT_MEDIA_MAX_BYTES = 100 * 1024 * 1024;
export const CHAT_MEDIA_ACCEPT = "image/*,video/*,audio/*";

export type ChatMediaKind = "image" | "video" | "audio" | "file";

export function chatMediaKind(name?: string | null): ChatMediaKind {
  const ext = (name || "").toLowerCase().split("?")[0].split(".").pop() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "tif", "tiff", "heic", "heif", "avif", "jfif"].includes(ext)) {
    return "image";
  }
  if (["mp4", "webm", "mov", "qt", "avi", "mkv", "mpeg", "mpg", "m4v", "3gp", "ogv", "wmv"].includes(ext)) {
    return "video";
  }
  if (["mp3", "wav", "ogg", "aac", "m4a", "flac", "wma", "aiff", "opus"].includes(ext)) {
    return "audio";
  }
  return "file";
}
