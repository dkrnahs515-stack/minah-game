const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const executablePath = process.env.PLAYWRIGHT_BROWSER_PATH;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route("https://www.gstatic.com/**", route => route.abort());
    await page.goto(process.env.PIXEL_WORLD_URL || "http://127.0.0.1:4173", { waitUntil: "networkidle" });
    assert.equal(await page.locator("#chatPanel").count(), 1);
    assert.equal(await page.locator("#chatMessages[aria-live=polite]").count(), 1);
    assert.equal(await page.locator("#chatForm").count(), 1);
    assert.equal(await page.locator("#chatInput").getAttribute("maxlength"), "1024");
    assert.equal(await page.locator("#chatInput").isDisabled(), true);
    await page.locator("#nicknameInput").fill("채팅UI검사");
    await page.locator("#enterButton").click();
    await page.locator("#hud").waitFor({ state: "visible" });
    const desktopBox = await page.locator("#chatPanel").boundingBox();
    assert.ok(desktopBox.x >= 8 && desktopBox.x <= 24);
    assert.ok(desktopBox.y + desktopBox.height <= 892);

    await page.setViewportSize({ width: 390, height: 760 });
    const mobileBox = await page.locator("#chatPanel").boundingBox();
    assert.ok(mobileBox.width <= 362);
    assert.ok(mobileBox.x >= 14);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
