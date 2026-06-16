import { test, expect } from "@playwright/test";
import { loginPartner } from "./helpers";

test.describe("Lead-Only Punch Flow", () => {
  test("CP can punch lead on CLOSED project and customer accept reaches terminal state", async ({ page }) => {
    const uniqueEmail = `leadonly.${Date.now()}@example.com`;

    await loginPartner(page, "partner@goyalprojects.com", "Partner@123");
    await page.goto("/partner/projects/seed-project-3");

    await expect(page.getByRole("button", { name: "Punch Lead" })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Punch Lead" }).click();

    await page.fill('input[placeholder="Full name"]', "Lead Only Customer");
    await page.fill('input[placeholder="10-digit mobile"]', "9876543211");
    await page.fill('input[placeholder="customer@email.com"]', uniqueEmail);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: /Punch Lead/i }).click();

    await expect(page.getByText(/Lead Punched/i)).toBeVisible({ timeout: 15_000 });

    const leadsRes = await page.request.get("/api/partner/leads?intentType=LEAD_ONLY");
    expect(leadsRes.ok()).toBeTruthy();
    const leads = await leadsRes.json();
    const lead = leads.find((l: { customerEmail: string }) => l.customerEmail === uniqueEmail);
    expect(lead).toBeTruthy();
    expect(lead.intentType).toBe("LEAD_ONLY");
    expect(lead.journeyStatus).toBe("CONFIRMATION_PENDING");
    expect(lead.eoi).toBeFalsy();

    const acceptRes = await page.request.post(`/api/confirm/${lead.inviteToken}`, {
      data: { action: "accept" },
    });
    expect(acceptRes.ok()).toBeTruthy();
    const acceptData = await acceptRes.json();
    expect(acceptData.intentType).toBe("LEAD_ONLY");
    expect(acceptData.inviteUrl).toBeUndefined();

    const updatedRes = await page.request.get("/api/partner/leads?intentType=LEAD_ONLY");
    const updatedLeads = await updatedRes.json();
    const updatedLead = updatedLeads.find((l: { id: string }) => l.id === lead.id);
    expect(updatedLead.journeyStatus).toBe("LEAD_CONFIRMED");
  });

  test("EOI submission is rejected on CLOSED project", async ({ page }) => {
    await loginPartner(page, "partner@goyalprojects.com", "Partner@123");

    const res = await page.request.post("/api/partner/leads", {
      data: {
        customerName: "Should Fail",
        mobile: "9876543212",
        email: `eoi.closed.${Date.now()}@example.com`,
        projectId: "seed-project-3",
        configuration: "2 BHK",
        fosName: "Test FOS",
        intentType: "EOI",
        sendConfirmation: true,
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/closed|Punch Lead/i);
  });
});
