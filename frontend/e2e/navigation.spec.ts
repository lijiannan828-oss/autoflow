import { test, expect } from "@playwright/test";

test.describe("Global Navigation", () => {
  test("sidebar nav links are visible on review page", async ({ page }) => {
    await page.goto("/review/art-assets");

    // GlobalNavSidebar renders links with labels: 管理, 任务, 美术, 视觉, 视听, 成片
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Check that navigation links are present
    await expect(sidebar.getByRole("link", { name: /美术/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /视觉/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /视听/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /成片/ })).toBeVisible();
  });

  test("clicking visual link navigates to visual page", async ({ page }) => {
    await page.goto("/review/art-assets");

    // Click the "视觉" nav link
    const sidebar = page.locator("aside").first();
    await sidebar.getByRole("link", { name: /视觉/ }).click();

    // URL should change to /review/visual
    await expect(page).toHaveURL(/\/review\/visual/);
  });

  test("clicking admin link navigates to admin page", async ({ page }) => {
    await page.goto("/review/art-assets");

    const sidebar = page.locator("aside").first();
    await sidebar.getByRole("link", { name: /管理/ }).click();

    await expect(page).toHaveURL(/\/admin/);
  });
});
