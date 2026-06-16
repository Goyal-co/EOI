import { approvalActionSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError } from "@/lib/api";
import { EOIEngine } from "@/lib/services/eoi-engine";
import { getSystemSettings } from "@/lib/services/system-settings";
import type { EOIStatus } from "@goyal/types";

const ACTION_STATUS_MAP = {
  APPROVE: "APPROVED" as EOIStatus,
  REJECT: "REJECTED" as EOIStatus,
  REQUEST_CORRECTION: "CORRECTION_REQUESTED" as EOIStatus,
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await withAuth(["ADMIN"]);
  if (error) return error;
  const { id } = await params;

  const settings = await getSystemSettings();
  const body = await req.json();
  const parsed = approvalActionSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);

  if (parsed.data.action === "REQUEST_CORRECTION" && !settings.eoiRules.allowCorrections) {
    return apiError("Corrections are disabled in system settings", 403);
  }

  const toStatus = ACTION_STATUS_MAP[parsed.data.action];

  try {
    const result = await EOIEngine.transition({
      eoiId: id,
      toStatus,
      actorId: session!.user.id,
      reason: parsed.data.reason,
      remarks: parsed.data.remarks,
      action: parsed.data.action,
      expectedStatus: body.expectedStatus as EOIStatus | undefined,
    });
    return apiResponse(result);
  } catch (e) {
    const message = (e as Error).message;
    if (message.includes("status changed")) return apiError(message, 409);
    return apiError(message, 400);
  }
}
