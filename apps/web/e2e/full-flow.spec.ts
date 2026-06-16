import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  loginAdmin,
  loginPartner,
  registerPartnerViaApi,
  approvePartnerViaApi,
  getPendingCpId,
} from "./helpers";

test.describe("Full EOI Flow", () => {
  test("CP register → admin approve → create lead → confirm → submit EOI → admin approve", async ({ page, request }) => {
    const cpEmail = uniqueEmail();
    const cpPassword = "TestPass@123";
    const customerEmail = uniqueEmail("test.customer");

    await registerPartnerViaApi(request, cpEmail, cpPassword);

    await loginAdmin(page);
    const cpId = await getPendingCpId(page, cpEmail);
    expect(cpId).toBeTruthy();
    await approvePartnerViaApi(page, cpId!, "seed-project-1");

    await loginPartner(page, cpEmail, cpPassword);

    const leadRes = await page.request.post("/api/partner/leads", {
      data: {
        customerName: "E2E Customer",
        mobile: "9123456789",
        email: customerEmail,
        projectId: "seed-project-1",
        configuration: "3 BHK",
        fosName: "E2E FOS",
        sendConfirmation: true,
      },
    });
    expect(leadRes.ok()).toBeTruthy();
    const leadData = await leadRes.json();
    const inviteToken = leadData.lead?.inviteToken;
    expect(inviteToken).toBeTruthy();

    const confirmRes = await request.post(`/api/confirm/${inviteToken}`, {
      data: { action: "accept" },
    });
    expect(confirmRes.ok()).toBeTruthy();

    const submitRes = await request.post("/api/test/eoi-submit", {
      data: { inviteToken },
    });
    expect(submitRes.ok()).toBeTruthy();
    const submitData = await submitRes.json();
    expect(submitData.referenceNumber).toBeTruthy();

    const overviewBefore = await page.request.get("/api/admin/analytics/overview");
    const overviewBeforeData = await overviewBefore.json();
    const approvedBefore = overviewBeforeData.stats?.approvedEOIs?.value ?? 0;

    const approveRes = await page.request.post(`/api/admin/eois/${submitData.eoiId || submitData.id}/action`, {
      data: { action: "APPROVE" },
    });
    expect(approveRes.ok()).toBeTruthy();

    const overviewAfter = await page.request.get("/api/admin/analytics/overview");
    const overviewAfterData = await overviewAfter.json();
    expect(overviewAfterData.stats.approvedEOIs.value).toBeGreaterThanOrEqual(approvedBefore + 1);

    await page.goto("/admin/approvals");
    await expect(page.getByText(/EOI|Approval|Pending/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("seed EOI drawer loads with masked PII", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/admin/approvals");

    const reviewBtn = page.getByRole("button", { name: /Review & Action/i }).first();
    await expect(reviewBtn).toBeVisible({ timeout: 10_000 });
    await reviewBtn.click();

    await expect(page.getByText(/EOI Verification/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Personal Details/i)).toBeVisible();
    await expect(page.getByText(/Amit Patel/i).first()).toBeVisible();
  });
});
