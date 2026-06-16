"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@goyal/ui";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import { ChunkErrorHandler } from "./chunk-error-handler";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));

  return (
    <ChunkErrorHandler>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
      </SessionProvider>
    </ChunkErrorHandler>
  );
}
