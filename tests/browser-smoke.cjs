const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

async function move(page, key, milliseconds) {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
}

async function expectRegion(page, regionName) {
  await page.locator(".player-header small").filter({ hasText: regionName }).waitFor({ timeout: 8000 });
}

(async () => {
  const executablePath = process.env.PLAYWRIGHT_BROWSER_PATH;
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("https://www.gstatic.com/**", route => route.abort());
    await page.goto(process.env.PIXEL_WORLD_URL || "http://127.0.0.1:4173", { waitUntil: "networkidle" });
    const screenshotDirectory = process.env.PIXEL_WORLD_SHOTS;
    if (screenshotDirectory) await fs.mkdir(screenshotDirectory, { recursive: true });
    assert.equal(await page.locator("#entryOverlay").isVisible(), true);
    assert.equal(await page.locator("#nicknameForm").count(), 1);
    assert.equal(await page.locator("#exitOverlay").count(), 1);
    assert.equal(await page.locator("#portalTransitionOverlay").count(), 1);
    assert.equal(await page.locator("#portalDestination").count(), 1);
    if (screenshotDirectory) await page.screenshot({ path: path.join(screenshotDirectory, "01-entry.png") });

    await page.locator("#nicknameInput").fill("포탈테스터");
    await page.locator("#enterButton").click();
    await page.locator("#hud").waitFor({ state: "visible" });
    await expectRegion(page, "중앙 마을");
    assert.match(await page.locator("#chatStatus").textContent(), /연결 실패|오프라인/);
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#chatInput").evaluate(element => document.activeElement === element), false);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#exitOverlay").isVisible(), true);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#exitOverlay").isVisible(), false);
    if (screenshotDirectory) await page.screenshot({ path: path.join(screenshotDirectory, "02-village.png") });

    await move(page, "ArrowUp", 2300);
    await move(page, "ArrowLeft", 3350);
    await move(page, "ArrowUp", 350);
    await expectRegion(page, "태고의 숲");
    await page.waitForTimeout(400);
    if (screenshotDirectory) await page.screenshot({ path: path.join(screenshotDirectory, "03-forest.png") });

    await page.waitForTimeout(1100);
    await move(page, "ArrowDown", 420);
    await expectRegion(page, "중앙 마을");

    await page.waitForTimeout(1100);
    await move(page, "ArrowUp", 2570);
    await move(page, "ArrowRight", 3350);
    await move(page, "ArrowUp", 350);
    await expectRegion(page, "끓어오르는 활화산");
    await page.waitForTimeout(400);
    if (screenshotDirectory) await page.screenshot({ path: path.join(screenshotDirectory, "04-volcano.png") });

    await page.waitForTimeout(1100);
    await move(page, "ArrowDown", 420);
    await expectRegion(page, "중앙 마을");

    await page.waitForTimeout(1100);
    await move(page, "ArrowLeft", 1900);
    await move(page, "ArrowDown", 2050);
    await move(page, "ArrowRight", 1750);
    await expectRegion(page, "푸른 해안가");
    await page.waitForTimeout(400);
    if (screenshotDirectory) await page.screenshot({ path: path.join(screenshotDirectory, "05-coast.png") });

    await page.waitForTimeout(1100);
    await move(page, "ArrowUp", 420);
    await expectRegion(page, "중앙 마을");

    await page.locator("#exitButton").click();
    assert.equal(await page.locator("#exitOverlay").isVisible(), true);
    await page.locator("#confirmExitButton").click();
    await page.locator("#entryOverlay").waitFor({ state: "visible" });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
