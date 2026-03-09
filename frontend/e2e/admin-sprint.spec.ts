import { test, expect } from "@playwright/test";

test.describe("Admin Sprint Dashboard", () => {
  test("page loads and renders sprint tabs", async ({ page }) => {
    await page.goto("/admin/sprint");

    // The page should render without crashing
    await expect(page).toHaveTitle(/视频分镜审阅平台/);

    // Sprint tab buttons should be visible (MVP-0 and v2.2 tabs)
    await expect(page.getByRole("button", { name: /MVP-0/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /v2\.2/i })).toBeVisible();
  });

  test("progress bars are visible", async ({ page }) => {
    await page.goto("/admin/sprint");

    // There should be at least one progress-related element on the page
    // The sprint page renders overall progress and per-agent progress bars
    const progressElements = page.locator("[role='progressbar'], .bg-emerald-500, .bg-blue-500");
    await expect(progressElements.first()).toBeVisible({ timeout: 10_000 });
  });

  test("can switch between sprint tabs", async ({ page }) => {
    await page.goto("/admin/sprint");

    // Click the v2.2 tab
    const v22Tab = page.getByRole("button", { name: /v2\.2/i });
    await v22Tab.click();

    // After switching, the page should still have content
    await expect(page.locator("main, [class*='card'], [class*='Card']").first()).toBeVisible();
  });
});
