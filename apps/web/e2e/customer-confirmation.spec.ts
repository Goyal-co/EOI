import { test, expect } from "@playwright/test";

test.describe("Customer Confirmation Flow", () => {
  test("confirm accept page loads for demo token", async ({ page }) => {
    await page.goto("/confirm/demo-invite-token-123/accept");
    await expect(page.getByText(/Hariyana|Goyal|Confirm|Accept/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("invite page loads after demo token acceptance state", async ({ page }) => {
    await page.goto("/invite/demo-invite-token-123");
    await expect(page.getByText(/Hariyana|Goyal/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("confirm reject page loads", async ({ page }) => {
    await page.goto("/confirm/demo-invite-token-123/reject");
    await expect(page.getByText(/Hariyana|Goyal|Reject|Decline/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
