import { chatMediaKind } from "@/lib/uploads/chat-media";

export function ChatAttachment({ url, name }: { url: string; name?: string | null }) {
  const kind = chatMediaKind(name || url);
  if (kind === "image") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mb-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name || "Shared image"} className="max-h-48 w-full rounded-lg object-cover" />
      </a>
    );
  }
  if (kind === "video") {
    return <video src={url} controls className="mb-1 max-h-48 w-full rounded-lg" />;
  }
  if (kind === "audio") {
    return <audio src={url} controls className="mb-1 w-full" />;
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mb-1 block text-xs font-semibold underline">
      {name || "Download file"}
    </a>
  );
}
