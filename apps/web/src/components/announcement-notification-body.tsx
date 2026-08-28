"use client";

import { useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { inlinePreviewUrl } from "@/lib/files/open-asset";

interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  kind: string;
}

export function AnnouncementNotificationBody({
  entityId,
  body,
}: {
  entityId?: string;
  body: string;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    if (!entityId) return;
    fetch(`/api/announcements/${entityId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.attachments) setAttachments(data.attachments);
      })
      .catch(() => {});
  }, [entityId]);

  return (
    <div>
      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{body}</p>
      {attachments.length > 0 && (
        <ul className="mt-2 space-y-1">
          {attachments.map((a) => (
            <li key={a.id}>
              <a
                href={inlinePreviewUrl(a.fileUrl.startsWith("/") ? a.fileUrl : `/api/files/${encodeURIComponent(a.fileUrl)}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#2563EB] hover:underline inline-flex items-center gap-1"
              >
                <Paperclip className="h-3 w-3" />
                {a.fileName}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
