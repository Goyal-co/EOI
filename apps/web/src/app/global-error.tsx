"use client";

import { useEffect } from "react";
import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (isChunkLoadError(error)) {
      reloadOnceForChunkError();
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Something went wrong</h2>
        <p style={{ color: "#64748B", marginTop: "0.5rem" }}>
          {isChunkLoadError(error)
            ? "Reloading the app to fetch the latest version..."
            : "An unexpected error occurred."}
        </p>
        {!isChunkLoadError(error) && (
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "1.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              border: "none",
              background: "#C9A84C",
              color: "white",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        )}
      </body>
    </html>
  );
}
