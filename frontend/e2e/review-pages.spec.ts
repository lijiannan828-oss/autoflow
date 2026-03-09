import { test, expect } from "@playwright/test";

test.describe("Review Pages Load", () => {
  test("art-assets review page loads", async ({ page }) => {
    await page.goto("/review/art-assets");

    // Page should render without errors
    await expect(page).toHaveTitle(/视频分镜审阅平台/);

    // The page uses ArtHeader, ArtNavSidebar, ArtWorkspace components
    // At minimum the body should have rendered content
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("visual review page loads", async ({ page }) => {
    await page.goto("/review/visual");

    await expect(page).toHaveTitle(/视频分镜审阅平台/);
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("audiovisual review page loads", async ({ page }) => {
    await page.goto("/review/audiovisual");

    await expect(page).toHaveTitle(/视频分镜审阅平台/);
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("final review page loads", async ({ page }) => {
    await page.goto("/review/final");

    await expect(page).toHaveTitle(/视频分镜审阅平台/);
    await expect(page.locator("body")).not.toBeEmpty();
  });
});

test.describe("Review Pages - Global Sidebar Present", () => {
  const reviewPaths = [
    "/review/art-assets",
    "/review/visual",
    "/review/audiovisual",
    "/review/final",
  ];

  for (const path of reviewPaths) {
    test(`${path} has global nav sidebar`, async ({ page }) => {
      await page.goto(path);

      // GlobalNavSidebar renders an <aside> with nav links
      const sidebar = page.locator("aside");
      await expect(sidebar.first()).toBeVisible({ timeout: 10_000 });
    });
  }
});
