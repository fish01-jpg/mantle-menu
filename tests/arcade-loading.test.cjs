'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const hub = fs.readFileSync(path.join(root, 'fishes-arcade.html'), 'utf8');
const mantle = fs.readFileSync(path.join(root, 'Mantle.html'), 'utf8');
const canonical = 'https://raw.githubusercontent.com/fish01-jpg/mantle-menu/main/';
const fn = name => {
  const match = hub.match(new RegExp('(?:async )?function ' + name + '\\([^\\n]*\\) \\{[\\s\\S]*?\\n\\}'));
  assert.ok(match, name + ' exists');
  return match[0];
};

// The browser matrix separately exercises the real DOMParser. This stub verifies
// that the loader delegates to the DOM, instead of interpreting script strings.
function parser(activeBase, calls) {
  return class DOMParser {
    parseFromString(html, type) {
      calls.push({html, type});
      return {querySelector(selector) {
        assert.equal(selector, 'base[href]');
        return activeBase ? {href: canonical} : null;
      }};
    }
  };
}

test('Arcade resolves every non-HTTP entry context without throwing', () => {
  const resolve = vm.runInNewContext(fn('resolveArcadeBase') + ';resolveArcadeBase', {URL});
  for (const base of ['about:blank', 'about:srcdoc', 'file:///Downloads/Mantle.html',
    'blob:https://example.test/id', 'data:text/html,hello', '', 'not a URL', undefined]) {
    assert.equal(resolve(base), canonical, String(base));
    for (const file of ['sp1der-intro.html', 'sp1der-mobile.html', 'tiers.html',
      'tetris/tetris.html', 'geometry-dash/index.html']) {
      assert.equal(new URL(file, resolve(base)).href, canonical + file);
    }
  }
  assert.equal(resolve('https://example.test/arcade/index.html'), 'https://example.test/arcade/');
  assert.equal(resolve('http://127.0.0.1:3000/index.html?test=1#app'), 'http://127.0.0.1:3000/');
  assert.equal(resolve(canonical), canonical);
  assert.match(hub, /const ARCADE_APP_BASE = resolveArcadeBase\(document\.baseURI\)/);
  assert.match(hub, /new URL\(localPaths\[id\], ARCADE_APP_BASE\)/);
  assert.doesNotMatch(hub, /new URL\(localPaths\[id\], document\.baseURI\)/);
});

for (const [label, content] of [
  ['script string', '<script>const tag = \'<base href="https://wrong.test/">\';</script>'],
  ['comment', '<!-- <base href="https://wrong.test/"> -->'],
  ['inert template', '<template><base href="https://wrong.test/"></template>'],
  ['target-only base', '<base target="_blank">']
]) {
  test('Arcade injects a real base despite a ' + label, () => {
    const html = '<html><head>' + content + '</head><body>App</body></html>';
    const calls = [];
    const result = vm.runInNewContext(fn('injectBase') + ';injectBase(html, base)', {
      html, base: canonical, DOMParser: parser(false, calls)
    });
    assert.ok(result.startsWith('<html><head><base href="' + canonical + '">'));
    assert.ok(result.includes(content));
    assert.deepEqual(calls, [{html, type: 'text/html'}]);
  });
}

test('Arcade preserves a real active base without rewriting the source', () => {
  const html = '<html><head><base href="https://existing.test/"></head></html>';
  const result = vm.runInNewContext(fn('injectBase') + ';injectBase(html, base)', {
    html, base: canonical, DOMParser: parser(true, [])
  });
  assert.equal(result, html);
});

test('Mantle checks the DOM before installing the actual Arcade source', () => {
  const install = mantle.match(/function install\(html, frameElement\) \{[\s\S]*?\n      \}/)[0];
  const calls = [], frame = {};
  vm.runInNewContext(install + ';install(html, frame)', {
    html: hub, frame, BASE_HREF: canonical, DOMParser: parser(false, calls)
  });
  assert.match(frame.srcdoc, new RegExp('<head[^>]*><base href="' + canonical + '">'));
  assert.deepEqual(calls, [{html: hub, type: 'text/html'}]);
  const existing = '<html><head><base href="https://existing.test/"></head></html>';
  vm.runInNewContext(install + ';install(html, frame)', {
    html: existing, frame, BASE_HREF: canonical, DOMParser: parser(true, [])
  });
  assert.equal(frame.srcdoc, existing);
});

test('source lists deduplicate identical URLs and retain the first mode', () => {
  const sources = [['https://a.test/app', 'https://a.test/', 'inline'],
    ['https://a.test/app', 'https://a.test/'], ['https://b.test/app', 'https://b.test/']];
  const result = vm.runInNewContext(fn('uniqueAppSources') + ';uniqueAppSources(sources)', {sources, Set});
  assert.deepEqual(Array.from(result), [sources[0], sources[2]]);
  assert.match(hub, /for \(const \[url, b, mode\] of uniqueAppSources\(app\.sources\)\)/);
  assert.match(hub, /for \(const \[url, sourceBase, mode\] of uniqueAppSources\(sources\)\)/);
});

function fetching(fetch) {
  let fireTimer, cleared = 0;
  const context = {
    fetch, AbortController,
    setTimeout(callback, ms) { assert.equal(ms, 20000); fireTimer = callback; return 1; },
    clearTimeout() { cleared++; }
  };
  return {
    run: vm.runInNewContext(fn('fetchText') + ';fetchText', context),
    timeout() { fireTimer(); },
    get cleared() { return cleared; }
  };
}
function untilAbort(signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'));
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, {once: true});
  });
}

test('a stalled source times out, rather than blocking later fallbacks forever', async () => {
  const r = fetching((url, options) => untilAbort(options.signal));
  const pending = r.run('https://example.test/app.html');
  r.timeout();
  await assert.rejects(pending, /Timed out loading app\.html/);
  assert.equal(r.cleared, 1);
});

test('the timeout also covers a stalled response body', async () => {
  const r = fetching(async (url, options) => ({ok: true, text: () => untilAbort(options.signal)}));
  const pending = r.run('https://example.test/script.js');
  await Promise.resolve();
  r.timeout();
  await assert.rejects(pending, /Timed out loading script\.js/);
  assert.equal(r.cleared, 1);
});

test('closing the player cancels nested script fetches too', async () => {
  const controller = new AbortController();
  const r = fetching((url, options) => untilAbort(options.signal));
  const pending = r.run('https://example.test/script.js', controller.signal);
  controller.abort();
  await assert.rejects(pending, {name: 'AbortError'});
  assert.equal(r.cleared, 1);
  assert.match(hub, /buildAppHtml\(text, sourceBase, mode, controller\.signal\)/);
  assert.match(fn('inlineScripts'), /fetchText\(url, signal\)/);
  assert.match(fn('patchWorkerChain'), /fetchText\(absUrl\("simulation_worker\.bundle\.js", base\), signal\)/);
});

test('successful text and HTTP errors clear their timeout', async () => {
  const ok = fetching(async () => ({ok: true, text: async () => 'app script'}));
  assert.equal(await ok.run('https://example.test/script.js'), 'app script');
  assert.equal(ok.cleared, 1);
  const bad = fetching(async () => ({ok: false, status: 404}));
  await assert.rejects(bad.run('https://example.test/missing.js'), /HTTP 404 on missing\.js/);
  assert.equal(bad.cleared, 1);
});

test('Tetris has an independent remote fallback with the correct asset root', () => {
  const block = hub.match(/"tetris": \{[\s\S]*?\n\},/)[0];
  assert.match(block, /raw\.githubusercontent\.com\/fish01-jpg\/mantle-menu\/main\/tetris\/tetris\.html/);
  assert.match(block, /cdn\.jsdelivr\.net\/gh\/fish01-jpg\/mantle-menu@main\/tetris\/tetris\.html/);
  assert.equal((block.match(/"inline"/g) || []).length, 2);
});

test('Mantle and Geometry Dash inline scripts parse', () => {
  for (const html of [mantle, fs.readFileSync(path.join(root, 'geometry-dash/index.html'), 'utf8')]) {
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
      assert.doesNotThrow(() => new vm.Script(match[1]));
    }
  }
  assert.match(mantle, /setTimeout\(\(\) => controller\.abort\(\), 20000\)/);
  assert.match(mantle, /const html = await fetchHub\(url\)/);
});

test('Geometry Dash keeps real storage and tolerates an opaque origin', () => {
  const html = fs.readFileSync(path.join(root, 'geometry-dash/index.html'), 'utf8');
  const shim = html.match(/<script>([\s\S]*?)<\/script>/i)[1];
  const real = {getItem() { return null; }};
  const normal = {localStorage: real};
  vm.runInNewContext(shim, {window: normal, Map});
  assert.equal(normal.localStorage, real);
  const opaque = {};
  Object.defineProperty(opaque, 'localStorage', {
    configurable: true, get() { throw new Error('Access denied'); }
  });
  vm.runInNewContext(shim, {window: opaque, Map});
  const storage = opaque.localStorage;
  assert.equal(storage.getItem('progress'), null);
  storage.setItem('progress', 42);
  assert.equal(storage.getItem('progress'), '42');
  assert.equal(storage.length, 1);
  assert.equal(storage.key(0), 'progress');
  storage.removeItem('progress');
  assert.equal(storage.length, 0);
  storage.setItem('level', 2);
  storage.clear();
  assert.equal(storage.getItem('level'), null);
});

test('Fluid texture images opt into CORS before src without changing other apps', () => {
  const prepare = vm.runInNewContext(fn('prepareEmbeddedApp') + ';prepareEmbeddedApp');
  const html = '<html><head></head><body>Fluid</body></html>';
  for (const id of ['sp1der', 'sp1der-intro', 'tetris', 'geometry-dash', 'tiers', 'polytrack']) {
    assert.equal(prepare(html, id), html);
  }
  const result = prepare(html, 'fluid');
  assert.ok(result.startsWith('<html><head><script>'));
  const script = result.match(/<script>([\s\S]*?)<\/script>/)[1];
  function NativeImage(...args) { this.args = args; }
  const win = {Image: NativeImage};
  vm.runInNewContext(script, {window: win});
  const texture = new win.Image();
  assert.equal(texture.crossOrigin, 'anonymous');
  assert.deepEqual(texture.args, []);
  assert.ok(texture instanceof NativeImage);
  assert.ok(texture instanceof win.Image);
  assert.deepEqual(new win.Image(12, 20).args, [12, 20]);
  assert.match(hub, /prepareEmbeddedApp\(html, id\)/);
  assert.match(hub, /prepareEmbeddedApp\(html, appId\)/);
});

test('large game chunks have a separate timeout without removing cancellation', () => {
  assert.match(hub, /async function phoneFetch\(url, signal, timeoutMs = 20000\)/);
  assert.match(hub, /setTimeout\(abort, timeoutMs\)/);
  assert.match(hub, /phoneFetch\(url, controller\.signal, 120000\)/);
  assert.match(hub, /signal\.addEventListener\("abort", abort, \{ once: true \}\)/);
});
