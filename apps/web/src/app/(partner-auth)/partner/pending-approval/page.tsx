import { Suspense } from "react";
import PartnerPendingApprovalContent from "./pending-content";

export default function PartnerPendingApprovalPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    }>
      <PartnerPendingApprovalContent />
    </Suspense>
  );
}
