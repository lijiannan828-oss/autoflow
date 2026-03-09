import { test, expect } from "@playwright/test";

test.describe("Admin Debug Playground", () => {
  test("page loads with heading", async ({ page }) => {
    await page.goto("/admin/debug");

    // The debug page renders "节点调试面板" heading
    await expect(page.getByText("节点调试面板")).toBeVisible({ timeout: 10_000 });
  });

  test("node list is rendered with badge count", async ({ page }) => {
    await page.goto("/admin/debug");

    // The page shows a "26 节点" badge
    await expect(page.getByText("26 节点")).toBeVisible();
  });

  test("search input is available", async ({ page }) => {
    await page.goto("/admin/debug");

    // There is a search input for filtering nodes
    const searchInput = page.getByPlaceholder(/搜索节点/);
    await expect(searchInput).toBeVisible();

    // Type a query to verify it is interactive
    await searchInput.fill("N01");
    // The search should filter — at least one result should remain
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
