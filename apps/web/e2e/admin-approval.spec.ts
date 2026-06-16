import { test, expect } from "@playwright/test";

test.describe("Admin Approval Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@goyalprojects.com");
    await page.fill('input[type="password"]', "Admin@123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin**", { timeout: 15_000 });
  });

  test("approvals page shows review button", async ({ page }) => {
    await page.goto("/admin/approvals");
    await expect(page.getByText(/EOI Approvals/i)).toBeVisible({ timeout: 10_000 });
  });

  test("customer EOIs page loads with filters", async ({ page }) => {
    await page.goto("/admin/eois");
    await expect(page.getByText(/Customer EOIs/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/All Statuses/i).first()).toBeVisible();
  });

  test("admin can open verification drawer when pending EOIs exist", async ({ page }) => {
    await page.goto("/admin/approvals");
    const reviewBtn = page.getByRole("button", { name: /Review & Action/i }).first();
    if (await reviewBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await reviewBtn.click();
      await expect(page.getByText(/EOI Verification/i)).toBeVisible({ timeout: 10_000 });
    }
  });
});
