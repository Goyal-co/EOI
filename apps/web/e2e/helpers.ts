import type { Page } from "@playwright/test";

export function uniqueEmail(prefix = "test.cp") {
  return `${prefix}.${Date.now()}@example.com`;
}

export async function loginAdmin(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', "admin@goyalprojects.com");
  await page.fill('input[type="password"]', "Admin@123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/admin**", { timeout: 15_000 });
}

export async function loginPartner(page: Page, email: string, password: string) {
  await page.goto("/partner/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/partner**", { timeout: 15_000 });
}

export async function registerPartnerViaApi(
  request: import("@playwright/test").APIRequestContext,
  email: string,
  password = "TestPass@123"
) {
  const step1 = {
    fullName: "E2E Test Partner",
    mobile: "9876543210",
    email,
    password,
    confirmPassword: password,
  };
  const step2 = {
    companyName: "E2E Realty",
    reraNumber: "P52100088888",
    panNumber: "ABCDE1234F",
  };

  await request.post("/api/partner/register", { data: { step: 1, data: step1 } });
  const res = await request.post("/api/partner/register", {
    data: { step: 3, data: { step1, step2 } },
  });
  return res.json();
}

export async function approvePartnerViaApi(
  page: Page,
  cpId: string,
  projectId = "seed-project-1"
) {
  const res = await page.request.patch(`/api/admin/channel-partners/${cpId}`, {
    data: { status: "APPROVED", projectIds: [projectId] },
  });
  return res.json();
}

export async function getPendingCpId(page: Page, email: string): Promise<string | null> {
  const res = await page.request.get("/api/admin/channel-partners");
  const cps = await res.json();
  const cp = cps.find((c: { email: string }) => c.email === email);
  return cp?.id ?? null;
}
