"use client";

import { Suspense } from "react";
import { AuthLayout, LoadingSkeleton } from "@goyal/ui";
import AuthErrorContent from "./error-content";

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout subtitle="Loading...">
          <LoadingSkeleton rows={3} />
        </AuthLayout>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
