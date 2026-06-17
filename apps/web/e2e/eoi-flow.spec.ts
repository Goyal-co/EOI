import { test, expect } from "@playwright/test";

test.describe("Goyal Hariyana Projects — Critical Flow", () => {
  test("root redirects guests to customer login", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/customer/login**", { timeout: 10_000 });
    await expect(page.getByText(/Hariyana|Goyal/i).first()).toBeVisible();
  });

  test("admin login and dashboard access", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@goyalprojects.com");
    await page.fill('input[type="password"]', "Admin@123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin**", { timeout: 15_000 });
    await expect(page.getByText("Dashboard").first()).toBeVisible();
  });

  test("partner login and dashboard access", async ({ page }) => {
    await page.goto("/partner/login");
    await page.fill('input[type="email"]', "partner@goyalprojects.com");
    await page.fill('input[type="password"]', "Partner@123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/partner**", { timeout: 15_000 });
    await expect(page.getByText("Dashboard").first()).toBeVisible();
  });

  test("invitation page loads with demo token", async ({ page }) => {
    await page.goto("/invite/demo-invite-token-123");
    await expect(page.getByText(/Hariyana|Goyal/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("admin can navigate to approvals page", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@goyalprojects.com");
    await page.fill('input[type="password"]', "Admin@123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin**", { timeout: 15_000 });

    await page.goto("/admin/approvals");
    await expect(page.getByText(/EOI|Approval|Pending/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("partner can navigate to projects page", async ({ page }) => {
    await page.goto("/partner/login");
    await page.fill('input[type="email"]', "partner@goyalprojects.com");
    await page.fill('input[type="password"]', "Partner@123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/partner**", { timeout: 15_000 });

    await page.goto("/partner/projects");
    await expect(page.getByText(/Project|Hariyana|Goyal/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("partner can navigate to leads page", async ({ page }) => {
    await page.goto("/partner/login");
    await page.fill('input[type="email"]', "partner@goyalprojects.com");
    await page.fill('input[type="password"]', "Partner@123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/partner**", { timeout: 15_000 });

    await page.goto("/partner/leads");
    await expect(page.getByText(/Lead|Customer/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
