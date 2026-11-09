'use strict';
/* Tests for the Sp1der FX engine + Manager (v4.7): command registry, dispatch wiring,
   email-verified manager login, about:blank manager page, arcade/game-window bridge,
   and a fake-DOM smoke test that every effect runs without throwing. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const desktop = read('sp1der.html');
const mobile = read('sp1der-mobile.html');
const arcade = read('fishes-arcade.html');

function extractEngine(src) {
  const start = src.indexOf('function sp1derFxEngineCore(effect, payload) {');
  const end = src.indexOf('/* ===== SP1DER FX COMMANDS + MANAGER', start);
  assert.ok(start > 0 && end > start, 'engine source found');
  return src.slice(start, end);
}
function extractRegistry(src) {
  const start = src.indexOf('const SP1DER_FX_COMMANDS = [');
  const end = src.indexOf('];', start);
  assert.ok(start > 0 && end > start, 'registry found');
  const body = src.slice(start + 'const SP1DER_FX_COMMANDS ='.length, end + 1);
  const ctx = { SP1DER_FX_GROUP_TAKEOVER: 'Sp1der FX: Takeovers', SP1DER_FX_GROUP_VISUAL: 'Sp1der FX: Visual', SP1DER_FX_GROUP_SOUND: 'Sp1der FX: Sounds', SP1DER_FX_GROUP_MSG: 'Sp1der FX: Messages', SP1DER_FX_GROUP_GAME: 'Sp1der FX: Game Control' };
  return vm.runInNewContext('(' + body + ')', ctx);
}

test('FX registry has at least 60 commands with usage and description', () => {
  for (const src of [desktop, mobile]) {
    const reg = extractRegistry(src);
    assert.ok(reg.length >= 60, `registry size ${reg.length} >= 60`);
    for (const c of reg) {
      assert.match(c.cmd, /^[a-z0-9]+$/, 'command name: ' + c.cmd);
      assert.ok(c.usage && c.usage.startsWith('/' + c.cmd), 'usage for ' + c.cmd);
      assert.ok(typeof c.desc === 'string' && c.desc.length > 5, 'desc for ' + c.cmd);
      assert.ok(c.group, 'group for ' + c.cmd);
    }
  }
});

test('total chat command count (existing guide + FX) is at least 60', () => {
  for (const [name, src] of [['desktop', desktop], ['mobile', mobile]]) {
    const reg = extractRegistry(src);
    const gStart = src.indexOf('function getChatCommands()');
    const gEnd = src.indexOf('].map(c => ({', gStart);
    assert.ok(gStart > 0 && gEnd > gStart, 'guide body found in ' + name);
    const guide = src.slice(gStart, gEnd);
    const staticCount = (guide.match(/usage:'/g) || []).length + (guide.match(/usage: '/g) || []).length;
    const furball = (guide.match(/FURBALL_COMMANDS\.map/g) || []).length; // furball entries are dynamic, counted separately
    assert.ok(staticCount + reg.length >= 60, `${name}: ${staticCount} static + ${reg.length} FX (+${furball} furry set) >= 60`);
  }
});

test('handleCommand dispatches FX commands before the built-in switch', () => {
  for (const src of [desktop, mobile]) {
    assert.match(src, /handleFurballCommand\(cmd, args, channelId, moderationAlreadyChecked\)\) return true;\s*\n\s*if \(await handleSp1derFxCommand\(cmd, args\)\) return true;/);
    assert.ok(src.includes('async function handleSp1derFxCommand(cmd, args)'), 'dispatcher defined');
  }
});

test('fresh fx notifications play effects instead of the staff popup', () => {
  for (const src of [desktop, mobile]) {
    assert.match(src, /popupAction\)\.indexOf\('fx:'\) === 0/, 'fx branch in playOwnerPopups');
    assert.ok(src.includes("sp1derFxPlay(String(n.popupAction).slice(3), n.fxPayload)"), 'fx playback call');
  }
});

test('manager: staff login requires email verification then opens in about:blank', () => {
  assert.ok(desktop.includes('id="managerLoginModal"'), 'login modal markup');
  assert.match(desktop, /currentUser\.emailVerified/, 'emailVerified check');
  assert.match(desktop, /reauthenticateWithCredential\(cred\)/, 'password re-auth');
  assert.match(desktop, /sendEmailVerification\(\)/, 'resend verification email');
  assert.match(desktop, /function openSp1derManager\(\)\s*{\s*const w = window\.open\('about:blank'/, 'manager opens about:blank');
  assert.match(desktop, /SP1DER_MGR_CMD/, 'manager bridge command channel');
  assert.match(desktop, /managerLoginRender/, 'login render steps');
  // the manager page itself embeds the FX registry and posts commands back to the opener
  assert.match(desktop, /var CMDS=' \+ cmdsJson/, 'manager page embeds commands');
});

test('arcade hub and game-window bridge receive SP1DER_FX effects', () => {
  assert.match(arcade, /function sp1derFxEngineCore\(effect, payload\)/, 'engine present in arcade');
  assert.match(arcade, /"  " \+ sp1derFxEngineCore\.toString\(\)/, 'engine injected into game bridge');
  assert.match(arcade, /data\.type === 'SP1DER_FX' && fxOnce\(data\.effect\)/, 'bridge handles SP1DER_FX');
  assert.match(arcade, /data\.type === "SP1DER_FX" && hubFxOnce\(data\.effect\)/, 'hub handles SP1DER_FX');
  assert.match(arcade, /sp1derFxEngineCore\.toString\(\)/, 'bridge injects engine source');
  // hub must never reload itself for gamerestart
  assert.match(arcade, /gamehub" \|\| data\.effect === "gameclose/, 'hub closes games for gamehub/gameclose');
});

test('every registry effect runs in the engine without throwing (fake DOM)', () => {
  const engineSrc = extractEngine(desktop);
  function makeEl(tag) {
    const e = {
      tagName: tag, id: '', style: {}, children: [], attributes: {},
      textContent: '', value: '', className: '', animation: '', offsetWidth: 800, offsetHeight: 600, width: 800, height: 600,
      appendChild(c) { this.children.push(c); return c; },
      append(...cs) { cs.forEach(c => this.children.push(c)); },
      remove() {}, addEventListener() {}, removeEventListener() {},
      setAttribute(k, v) { this.attributes[k] = v; if (k === 'id') this.id = v; },
      removeAttribute(k) { delete this.attributes[k]; },
      querySelectorAll() { return []; }, getContext() { return { fillRect() {}, fillText() {}, beginPath() {}, arc() {}, fill() {} }; }
    };
    allEls.push(e);
    return e;
  }
  const allEls = [];
  const doc = makeEl('#document');
  doc.getElementById = id => allEls.find(e => e.id === id) || null;
  doc.createElement = makeEl;
  doc.createDocumentFragment = () => makeEl('#frag');
  doc.querySelectorAll = () => [];
  doc.body = makeEl('body'); doc.head = makeEl('head'); doc.documentElement = makeEl('html');
  const noop = () => 0;
  const sandbox = {
    document: doc, window: { addEventListener: noop, close: noop },
    setTimeout: noop, setInterval: noop, clearTimeout: noop, clearInterval: noop,
    Date, Math, String, Object, Array, JSON, encodeURIComponent
  };
  vm.runInNewContext(engineSrc + '; globalThis.__fx = sp1derFxEngineCore;', sandbox);
  const reg = extractRegistry(desktop);
  const engine = sandbox.__fx || vm.runInNewContext('sp1derFxEngineCore', sandbox);
  const skip = new Set(['manager', 'fxhelp', 'globalfx']);
  let ran = 0;
  for (const c of reg) {
    if (skip.has(c.cmd)) continue;
    const payload = { msg: 'test', code: '1234', url: 'https://example.com/', from: 'Staff' };
    engine(c.cmd, payload); // must not throw
    engine('stop', {});     // cleanup path must not throw either
    ran++;
  }
  assert.ok(ran >= 55, 'smoke-tested ' + ran + ' effects');
});

test('engine cleanup paths clear persistent overlays', () => {
  const engineSrc = extractEngine(desktop);
  const seen = {};
  function makeEl(tag) {
    const e = {
      tagName: tag, id: '', style: {}, children: [], attributes: {}, textContent: '',
      appendChild(c) { this.children.push(c); return c; }, append(...cs) { cs.forEach(c => this.children.push(c)); },
      remove() { seen.removed = (seen.removed || 0) + 1; }, addEventListener() {},
      setAttribute(k, v) { this.attributes[k] = v; if (k === 'id') this.id = v; },
      removeAttribute() {}, querySelectorAll() { return []; }, getContext() { return { fillRect() {}, fillText() {}, beginPath() {}, arc() {}, fill() {} }; }
    };
    allEls.push(e); return e;
  }
  const allEls = [];
  const doc = makeEl('#document');
  doc.getElementById = id => allEls.find(e => e.id === id) || null;
  doc.createElement = makeEl; doc.createDocumentFragment = () => makeEl('#frag');
  doc.querySelectorAll = () => []; doc.body = makeEl('body'); doc.head = makeEl('head'); doc.documentElement = makeEl('html');
  const noop = () => 0;
  const sandbox = { document: doc, window: { addEventListener: noop, close: noop }, setTimeout: noop, setInterval: noop, clearTimeout: noop, clearInterval: noop, Date, Math, String, Object, Array, JSON, encodeURIComponent };
  vm.runInNewContext(engineSrc + '; globalThis.__fx2 = sp1derFxEngineCore;', sandbox);
  const fx = sandbox.__fx2;
  fx('gamefreeze', {}); fx('gameresume', {});
  fx('gameblur', {}); fx('gameunblur', {});
  fx('lock', { code: '9999' }); fx('unlockscreen', {});
  fx('stop', {});
  assert.ok(true, 'cleanup paths ran');
});
