"use client";

import { Suspense } from "react";
import { AuthLayout, LoadingSkeleton } from "@goyal/ui";
import CustomerLoginContent from "./login-content";

export default function CustomerLoginPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout portalLabel="Customer Portal" subtitle="Loading...">
          <LoadingSkeleton rows={4} />
        </AuthLayout>
      }
    >
      <CustomerLoginContent />
    </Suspense>
  );
}
