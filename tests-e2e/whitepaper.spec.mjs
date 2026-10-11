import { expect, test } from "@playwright/test"

test("mobile landing title is restrained and version starts below the cover", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only layout")
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })
    for (const route of ["/", "/zh/"]) {
      await page.goto(route)
      const layout = await page.evaluate(() => {
        const heading = document.querySelector(".landing-copy h1")
        const cover = document.querySelector(".landing-heading").getBoundingClientRect()
        const version = document.querySelector(".landing-source p").getBoundingClientRect()
        return {
          titleSize: parseFloat(getComputedStyle(heading).fontSize),
          titleLeft: heading.getBoundingClientRect().left,
          versionLeft: version.left,
          gap: version.top - cover.bottom,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      })
      expect(layout.titleSize).toBeLessThanOrEqual(44)
      expect(layout.gap).toBeGreaterThanOrEqual(23)
      expect(Math.abs(layout.titleLeft - layout.versionLeft)).toBeLessThanOrEqual(1)
      expect(layout.overflow).toBeLessThanOrEqual(1)
    }
  }
})

test("English document navigation, anchors, search, and language pairing work", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1, name: "DI Whitepaper (English Version)" })).toBeVisible()
  await expect(page.locator(".chapter-grid a")).toHaveCount(17)
  await expect(page.locator(".header-nav")).toHaveCount(0)
  await expect(page.locator("[data-edge-waves]")).toBeVisible()

  await page.locator(".chapter-grid a").first().click()
  await expect(page).toHaveURL(/\/en\/01-overview\/$/)
  await expect(page.locator(".chapter-link[aria-current='page']")).toContainText("Overview")
  await expect(page.locator(".pagination-link.next")).toContainText("User Needs")

  await page.getByRole("button", { name: "Search" }).click()
  await page.getByRole("searchbox").fill("Event Engine")
  await expect(page.locator(".search-result").first()).toBeVisible()
  await expect(page.locator(".search-result").first()).toContainText(/Event Engine/i)
  await page.keyboard.press("Escape")

  await page.locator(".language-switch").click()
  await expect(page).toHaveURL(/\/zh\/01-overview\/$/)
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN")
})

test("Chinese content and diagrams render without broken local images", async ({ page }, testInfo) => {
  await page.goto("/zh/03-architecture/")
  await expect(page.getByRole("heading", { level: 1, name: /产品架构/ })).toBeVisible()
  const image = page.locator(".document-figure img")
  await expect(image).toBeVisible()
  expect(await image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0)
  if (testInfo.project.name === "chromium") {
    await expect(page.locator(".page-outline a").first()).toBeVisible()
  } else {
    await expect(page.locator(".page-outline")).toBeHidden()
  }
})

test("mobile chapter drawer is usable and the page has no horizontal overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only interaction")
  await page.goto("/zh/06-event-engine/")
  await page.locator("[data-menu-toggle]").click()
  await expect(page.locator("#chapter-sidebar")).toBeVisible()
  await expect(page.locator("body")).toHaveClass(/menu-open/)
  await page.locator("[data-menu-close]").click({ position: { x: 350, y: 300 } }).catch(() => page.keyboard.press("Escape"))
  await expect(page.locator("body")).not.toHaveClass(/menu-open/)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
