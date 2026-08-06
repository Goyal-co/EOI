import { test, expect } from "@playwright/test";

const CP_EMAIL = process.env.E2E_CP_EMAIL || "work.goyalco@gmail.com";
const CP_PASS = process.env.E2E_CP_PASSWORD || "UiPunch@2026";
const stamp = Date.now().toString().slice(-6);

async function loginAsCp(page: import("@playwright/test").Page) {
  await page.goto("/partner/login");
  await page.getByLabel("Email").fill(CP_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(CP_PASS);
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/\/partner(?!\/login)/, { timeout: 30_000 });
}

test.describe("Partner UI punch flows", () => {
  test.setTimeout(120_000);

  test("Submit EOI from dashboard project card", async ({ page }) => {
    await loginAsCp(page);

    const eoiCard = page
      .locator("div")
      .filter({ has: page.getByRole("button", { name: "Submit EOI" }) })
      .filter({ has: page.getByRole("heading") })
      .first();
    await expect(eoiCard.getByRole("button", { name: "Submit EOI" })).toBeVisible({ timeout: 30_000 });
    await eoiCard.getByRole("button", { name: "Submit EOI" }).click();

    await expect(page.getByRole("heading", { name: /Submit EOI/i })).toBeVisible();
    await page.getByLabel("Customer Name").fill(`UI EOI ${stamp}`);
    await page.getByLabel("Mobile").fill(`9888${stamp}`.slice(0, 10));
    await page.getByLabel("Email").fill(`ui.eoi.${stamp}@example.com`);
    await page.getByLabel("FOS Name").fill("UI FOS");
    await page.getByLabel("Unit Preference").selectOption("2 BHK");
    await page.getByLabel("City").fill("Bangalore");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("UI EOI " + stamp)).toBeVisible();
    await page.getByRole("button", { name: "Send Confirmation" }).click();

    await expect(page.getByRole("heading", { name: /Confirmation Sent|Customer Saved/i })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("Lead ID")).toBeVisible();
    await expect(page.locator(".font-mono").filter({ hasText: /EOI-/ })).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
  });

  test("Punch Lead from dashboard project card", async ({ page }) => {
    await loginAsCp(page);

    const leadCard = page
      .locator("div")
      .filter({ has: page.getByRole("button", { name: "Punch Lead" }) })
      .filter({ has: page.getByRole("heading") })
      .first();
    await expect(leadCard.getByRole("button", { name: "Punch Lead" })).toBeVisible({ timeout: 30_000 });
    await leadCard.getByRole("button", { name: "Punch Lead" }).click();

    await expect(page.getByRole("heading", { name: /Punch Lead/i })).toBeVisible();
    await page.getByLabel("Customer Name").fill(`UI Lead ${stamp}`);
    await page.getByLabel("Mobile").fill(`9777${stamp}`.slice(0, 10));
    await page.getByLabel("Email").fill(`ui.lead.${stamp}@example.com`);
    await page.getByLabel("FOS Name").fill("UI FOS");
    await page.getByLabel("City").fill("Bangalore");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("UI Lead " + stamp)).toBeVisible();
    await page.getByRole("button", { name: /Punch Lead & Send Confirmation/i }).click();

    await expect(page.getByRole("heading", { name: /Lead Punched|Lead Saved/i })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("Lead ID")).toBeVisible();
    await expect(page.locator(".font-mono").filter({ hasText: /LEAD-/ })).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
  });
});
