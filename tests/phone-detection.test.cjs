/* Run with: node --test tests/phone-detection.test.cjs */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "fishes-arcade.html"), "utf8");
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
const detector = scripts.find(script => script.includes("const uaPhone"));

function environment({ ua = "Desktop browser", width = 1440, height = 900, screenWidth = 1920, screenHeight = 1080, coarse = false, mobileHint = false } = {}) {
  const listeners = {};
  const state = {
    navigator: { userAgent: ua, userAgentData: { mobile: mobileHint } },
    screen: { width: screenWidth, height: screenHeight },
    innerWidth: width,
    innerHeight: height,
    document: { documentElement: { dataset: {} } },
    requestAnimationFrame: callback => callback(),
    CustomEvent: class { constructor(type) { this.type = type; } },
    dispatchEvent() {},
    addEventListener(name, callback) { (listeners[name] ||= []).push(callback); },
  };
  state.window = state;
  state.matchMedia = query => ({
    get matches() {
      if (query.includes("pointer")) return coarse;
      if (query.includes("max-width")) return state.innerWidth <= 600;
      return state.innerWidth > state.innerHeight;
    },
    addEventListener() {},
  });
  vm.runInNewContext(detector, state);
  return {
    get device() { return state.MantleDevice.isPhone; },
    get orientation() { return state.document.documentElement.dataset.orientation; },
    resize(width, height) {
      state.innerWidth = width; state.innerHeight = height;
      for (const listener of listeners.resize || []) listener();
    },
  };
}

test("all inline hub and Tetris scripts have valid JavaScript syntax", () => {
  for (const filename of ["fishes-arcade.html", "tetris/tetris.html"]) {
    const source = fs.readFileSync(path.join(root, filename), "utf8");
    for (const [index, match] of [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].entries()) {
      assert.doesNotThrow(() => new vm.Script(match[1], { filename: filename + ":" + index }));
    }
  }
  assert.doesNotThrow(() => new vm.Script(fs.readFileSync(path.join(root, "tetris/tetris.js"), "utf8")));
});

test("iPhone stays in phone mode across rotations", () => {
  const device = environment({ ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", width: 390, height: 844, screenWidth: 390, screenHeight: 844, coarse: true });
  assert.equal(device.device, true);
  assert.equal(device.orientation, "portrait");
  device.resize(844, 390);
  assert.equal(device.device, true);
  assert.equal(device.orientation, "landscape");
  device.resize(390, 844);
  assert.equal(device.device, true);
  assert.equal(device.orientation, "portrait");
});

test("Android phone is detected in a wide landscape viewport", () => {
  assert.equal(environment({ ua: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36", width: 932, height: 430 }).device, true);
});

test("mobile user-agent hint is respected", () => {
  assert.equal(environment({ mobileHint: true, width: 932, height: 430 }).device, true);
});

test("small touch devices work without a recognizable user agent", () => {
  assert.equal(environment({ coarse: true, screenWidth: 430, screenHeight: 932, width: 932, height: 430 }).device, true);
});

test("desktop switches to compact mode and restores desktop after resize", () => {
  const device = environment();
  assert.equal(device.device, false);
  device.resize(375, 800);
  assert.equal(device.device, true);
  device.resize(1440, 900);
  assert.equal(device.device, false);
});

test("a touch laptop is not classified as a phone", () => {
  assert.equal(environment({ coarse: true, width: 1280, height: 800, screenWidth: 1280, screenHeight: 800 }).device, false);
});

test("a short desktop window is not classified as a phone", () => {
  assert.equal(environment({ width: 1280, height: 390 }).device, false);
});

test("a full-size tablet is not classified as a phone", () => {
  assert.equal(environment({ ua: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)", coarse: true, screenWidth: 768, screenHeight: 1024, width: 1024, height: 768 }).device, false);
});

test("Tetris rejects rotations below the floor without reading past the board", () => {
  const engine = fs.readFileSync(path.join(root, "tetris/tetris.js"), "utf8");
  const move = engine.match(/var tryMove = function\(newX, dir\) \{[\s\S]*?\n    \};/)[0];
  const state = { curPiece: { 0: [0, 1] }, curX: 0, curY: 1, direction: 0, tilesX: 2, tilesY: 2, board: [[], []] };
  vm.runInNewContext(move, state);
  assert.equal(state.tryMove(0, 0), false);
  state.curY = 0;
  assert.equal(state.tryMove(0, 0), true);
  assert.equal(state.tryMove(-1, 0), false);
  assert.equal(state.tryMove(2, 0), false);
});
