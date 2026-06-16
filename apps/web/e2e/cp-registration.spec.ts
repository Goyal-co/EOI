import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers";

test.describe("CP Registration Flow", () => {
  test("register → pending page → login blocked for pending CP", async ({ page }) => {
    const email = `test.cp.${Date.now()}@example.com`;

    await page.goto("/partner/register");
    await page.getByLabel("Full Name").fill("Test Partner");
    await page.getByLabel("Mobile").fill("9876543210");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("TestPass@123");
    await page.getByLabel("Confirm Password").fill("TestPass@123");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("RERA Number").fill("P52100099999");
    await page.getByLabel("PAN Number").fill("ABCDE1234F");
    await page.getByRole("button", { name: "Submit Registration" }).click();

    await page.waitForURL("**/partner/pending-approval**", { timeout: 15_000 });
    await expect(page.getByText(/Pending Approval/i)).toBeVisible();

    await page.goto("/partner/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', "TestPass@123");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/partner/pending-approval**", { timeout: 15_000 });
    await expect(page.getByText(/Pending Approval/i)).toBeVisible();
  });

  test("duplicate email shows error on registration", async ({ page }) => {
    await page.goto("/partner/register");
    await page.getByLabel("Full Name").fill("Duplicate Test");
    await page.getByLabel("Mobile").fill("9876543219");
    await page.getByLabel("Email").fill("partner@goyalprojects.com");
    await page.getByLabel("Password", { exact: true }).fill("TestPass@123");
    await page.getByLabel("Confirm Password").fill("TestPass@123");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText(/already registered/i)).toBeVisible({ timeout: 10_000 });
  });

  test("admin receives in-app notification on CP registration", async ({ page }) => {
    const email = `notify.cp.${Date.now()}@example.com`;

    await page.goto("/partner/register");
    await page.getByLabel("Full Name").fill("Notify Test Partner");
    await page.getByLabel("Mobile").fill("9876543220");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("TestPass@123");
    await page.getByLabel("Confirm Password").fill("TestPass@123");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("RERA Number").fill("P52100088888");
    await page.getByLabel("PAN Number").fill("FGHIJ5678K");
    await page.getByRole("button", { name: "Submit Registration" }).click();
    await page.waitForURL("**/partner/pending-approval**", { timeout: 15_000 });

    await loginAdmin(page);
    const res = await page.request.get("/api/notifications");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.notifications.some((n: { body: string }) => n.body.includes("Notify Test Partner"))).toBe(true);
  });
});
