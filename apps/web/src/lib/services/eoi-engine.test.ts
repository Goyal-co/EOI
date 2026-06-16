import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockFindUniqueOrThrow: vi.fn(),
  mockTransaction: vi.fn(),
  mockLeadUpdate: vi.fn(),
  mockApprovalCreate: vi.fn(),
  mockUserFindMany: vi.fn(),
  mockSystemSettingsFindUnique: vi.fn(),
}));

vi.mock("@goyal/db", () => ({
  prisma: {
    eOI: {
      findUnique: mocks.mockFindUnique,
    },
    systemSettings: {
      findUnique: mocks.mockSystemSettingsFindUnique,
    },
    $transaction: mocks.mockTransaction,
    user: { findMany: mocks.mockUserFindMany },
  },
}));

vi.mock("@goyal/email", () => ({
  NotificationService: {
    notifyEOISubmitted: vi.fn(),
    notifyCustomerEOISubmitted: vi.fn(),
    notifyCPCustomerSubmitted: vi.fn(),
    notifyEOIApproved: vi.fn(),
  },
}));

vi.mock("@goyal/integrations", () => ({
  getCRMProvider: () => ({ syncEOI: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock("./audit", () => ({
  writeAudit: vi.fn(),
}));

import { EOIEngine } from "./eoi-engine";

describe("EOIEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSystemSettingsFindUnique.mockResolvedValue(null);
    mocks.mockUpdateMany.mockResolvedValue({ count: 1 });
    mocks.mockFindUniqueOrThrow.mockResolvedValue({ id: "eoi-1", status: "SUBMITTED", referenceNumber: "EOI-2026-000001" });
    mocks.mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        eOI: {
          updateMany: mocks.mockUpdateMany,
          findUniqueOrThrow: mocks.mockFindUniqueOrThrow,
        },
        approvalAction: { create: mocks.mockApprovalCreate },
        lead: { update: mocks.mockLeadUpdate },
      })
    );
    mocks.mockUserFindMany.mockResolvedValue([]);
  });

  it("rejects invalid status transition", async () => {
    mocks.mockFindUnique.mockResolvedValue({
      id: "eoi-1",
      status: "APPROVED",
      leadId: "lead-1",
      referenceNumber: "EOI-2026-000001",
      confirmationNumber: null,
      chequeNumber: "123",
      chequeUploaded: true,
      adminRemarks: null,
      rejectionReason: null,
      submittedAt: new Date(),
      approvedAt: new Date(),
      lead: { customerName: "Test" },
      project: { name: "Project" },
      cp: { user: null },
      customer: { user: null },
      documents: [],
    });

    await expect(
      EOIEngine.transition({ eoiId: "eoi-1", toStatus: "SUBMITTED", actorId: "user-1" })
    ).rejects.toThrow("Cannot transition");
  });

  it("transitions DRAFT to SUBMITTED with reference number", async () => {
    mocks.mockFindUnique.mockResolvedValue({
      id: "eoi-1",
      status: "DRAFT",
      leadId: "lead-1",
      referenceNumber: null,
      confirmationNumber: null,
      chequeNumber: "CHQ123",
      chequeUploaded: true,
      adminRemarks: null,
      rejectionReason: null,
      submittedAt: null,
      approvedAt: null,
      lead: { customerName: "Amit Patel" },
      project: { name: "Goyal Heights" },
      cp: { user: { id: "cp-user", email: "cp@test.com", name: "CP" } },
      customer: { user: { id: "cust-user", email: "cust@test.com" } },
      documents: [{ type: "CHEQUE" }],
    });

    mocks.mockFindUniqueOrThrow.mockResolvedValue({ id: "eoi-1", status: "SUBMITTED", referenceNumber: "EOI-2026-000001" });

    const result = await EOIEngine.transition({
      eoiId: "eoi-1",
      toStatus: "SUBMITTED",
      actorId: "cust-user",
      chequeNumber: "CHQ123",
      chequeUploaded: true,
    });

    expect(result.status).toBe("SUBMITTED");
    expect(mocks.mockTransaction).toHaveBeenCalled();
    expect(mocks.mockLeadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { journeyStatus: "SUBMITTED" } })
    );
  });

  it("transitions SUBMITTED to APPROVED with approval action", async () => {
    mocks.mockFindUnique.mockResolvedValue({
      id: "eoi-1",
      status: "SUBMITTED",
      leadId: "lead-1",
      referenceNumber: "EOI-2026-000001",
      confirmationNumber: null,
      chequeNumber: "CHQ123",
      chequeUploaded: true,
      adminRemarks: null,
      rejectionReason: null,
      submittedAt: new Date(),
      approvedAt: null,
      lead: { customerName: "Amit Patel" },
      project: { name: "Goyal Heights" },
      cp: { user: { id: "cp-user" } },
      customer: { user: { id: "cust-user", email: "cust@test.com" } },
      documents: [],
    });

    mocks.mockFindUniqueOrThrow.mockResolvedValue({ id: "eoi-1", status: "APPROVED" });

    await EOIEngine.transition({
      eoiId: "eoi-1",
      toStatus: "APPROVED",
      actorId: "admin-1",
      action: "APPROVE",
    });

    expect(mocks.mockApprovalCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "APPROVE" }) })
    );
  });
});
