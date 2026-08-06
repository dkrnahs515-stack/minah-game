const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const appModule = `
export const getApps = () => globalThis.__fakeApps || [];
export const getApp = () => globalThis.__fakeApps[0];
export const initializeApp = () => {
  const app = {};
  globalThis.__fakeApps = [app];
  return app;
};`;

const authModule = `
export const getAuth = () => ({ currentUser: { uid: "test-user" } });
export const signInAnonymously = async () => ({ user: { uid: "test-user" } });`;

const databaseModule = `
const state = globalThis.__fakeDatabase ||= { listeners: new Map(), chat: {}, lastPlayer: null, sequence: 0 };
const emit = path => {
  const callback = state.listeners.get(path);
  if (!callback) return;
  const value = path.endsWith('/chat') ? state.chat : path.endsWith('/players') ? {} : null;
  queueMicrotask(() => callback({ val: () => value }));
};
export const getDatabase = () => ({});
export const ref = (_db, path) => ({ path, key: path.split('/').at(-1) });
export const onValue = (reference, callback) => {
  state.listeners.set(reference.path, callback);
  queueMicrotask(() => callback({ val: () => reference.path === '.info/connected' ? true : reference.path.endsWith('/chat') ? state.chat : {} }));
  return () => state.listeners.delete(reference.path);
};
export const onDisconnect = () => ({ remove: async () => {}, cancel: async () => {} });
export const serverTimestamp = () => Date.now();
export const push = reference => ({ path: reference.path + '/message-' + (++state.sequence), key: 'message-' + state.sequence });
export const get = async reference => ({ val: () => {
  const uid = reference.path.split('/').at(-1);
  return state.chat[uid] || {};
} });
export const update = async (reference, values) => {
  if (reference.path.includes('/chat/')) {
    const uid = reference.path.split('/').at(-1);
    const bucket = state.chat[uid] ||= {};
    for (const [key, value] of Object.entries(values)) {
      if (value === null) delete bucket[key]; else bucket[key] = value;
    }
    emit('rooms/public/chat');
  } else if (reference.path.includes('/players/')) {
    state.lastPlayer = { ...values };
  }
};
export const remove = async reference => {
  if (reference.path.includes('/chat/')) {
    delete state.chat[reference.path.split('/').at(-1)];
    emit('rooms/public/chat');
  }
};`;

(async () => {
  const executablePath = process.env.PLAYWRIGHT_BROWSER_PATH;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js", route => route.fulfill({
      status: 200, contentType: "text/javascript", headers: { "access-control-allow-origin": "*" }, body: appModule,
    }));
    await page.route("https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js", route => route.fulfill({
      status: 200, contentType: "text/javascript", headers: { "access-control-allow-origin": "*" }, body: authModule,
    }));
    await page.route("https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js", route => route.fulfill({
      status: 200, contentType: "text/javascript", headers: { "access-control-allow-origin": "*" }, body: databaseModule,
    }));
    await page.goto(process.env.PIXEL_WORLD_URL || "http://127.0.0.1:4173", { waitUntil: "networkidle" });
    await page.locator("#nicknameInput").fill("채팅테스터");
    await page.locator("#enterButton").click();
    await page.locator("#hud").waitFor({ state: "visible" });
    await page.locator("#chatInput").waitFor({ state: "attached" });
    await page.waitForFunction(() => !document.querySelector("#chatInput").disabled, null, { timeout: 5000 });

    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#chatInput").evaluate(element => document.activeElement === element), true);
    await page.locator("#chatInput").fill("안녕 월드 👨‍👩‍👧‍👦");
    await page.keyboard.press("Enter");
    await page.locator("#chatMessages li").filter({ hasText: "안녕 월드" }).waitFor();
    const screenshotDirectory = process.env.PIXEL_WORLD_SHOTS;
    if (screenshotDirectory) {
      await fs.mkdir(screenshotDirectory, { recursive: true });
      await page.screenshot({ path: path.join(screenshotDirectory, "chat-online.png") });
    }

    await page.keyboard.press("Enter");
    const before = await page.evaluate(() => globalThis.__fakeDatabase.lastPlayer?.x);
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(250);
    await page.keyboard.up("ArrowRight");
    const after = await page.evaluate(() => globalThis.__fakeDatabase.lastPlayer?.x);
    assert.equal(after, before);

    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#exitOverlay").isVisible(), false);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#exitOverlay").isVisible(), true);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
