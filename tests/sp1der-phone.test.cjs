'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'mobile/sp1der-phone.js'), 'utf8').trim();
const css = fs.readFileSync(path.join(root, 'mobile/sp1der-phone.css'), 'utf8').trim();

function detector({ ua = 'Desktop Chrome', hint = false, coarse = false, width = 1440, height = 900,
    screenWidth = width, screenHeight = height, legacy = false } = {}) {
    const listeners = {};
    const events = [];
    const styles = {};
    const classes = new Set();
    const media = {
        '(pointer: coarse)': { matches: coarse },
        '(max-width: 600px)': { matches: width <= 600 }
    };
    Object.values(media).forEach(mq => {
        mq[legacy ? 'addListener' : 'addEventListener'] = () => {};
    });
    const document = {
        readyState: 'loading',
        activeElement: null,
        documentElement: {
            dataset: {}, style: { setProperty: (name, value) => { styles[name] = value; } },
            classList: { toggle: (name, on) => on ? classes.add(name) : classes.delete(name) }
        },
        addEventListener: (name, cb) => { listeners[name] = cb; }
    };
    const context = {
        document, navigator: { userAgent: ua, userAgentData: { mobile: hint } },
        screen: { width: screenWidth, height: screenHeight },
        innerWidth: width, innerHeight: height,
        visualViewport: { height, offsetTop: 0, addEventListener: () => {} },
        matchMedia: query => media[query],
        addEventListener: (name, cb) => { listeners[name] = cb; },
        dispatchEvent: event => events.push(event),
        requestAnimationFrame: cb => cb(),
        CustomEvent: function (type, options) { this.type = type; this.detail = options.detail; }
    };
    context.window = context;
    vm.runInNewContext(script, context);
    return {
        context, document, styles, classes, events,
        resize(width, height) {
            context.innerWidth = width; context.innerHeight = height;
            if (context.visualViewport) context.visualViewport.height = height;
            media['(max-width: 600px)'].matches = width <= 600;
            listeners.resize();
        },
        refresh: () => listeners.resize()
    };
}

for (const ua of ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit Chrome/130 Mobile Safari',
    'Mozilla/5.0 (Windows Phone 10.0)']) {
    test('phone UA survives wide landscape: ' + ua, () => {
        const d = detector({ ua, width: 390, height: 844 });
        assert.equal(d.context.Sp1derDevice.phone, true);
        assert.equal(d.context.Sp1derDevice.physicalPhone, true);
        d.resize(1080, 540);
        assert.equal(d.context.Sp1derDevice.phone, true);
        assert.equal(d.context.Sp1derDevice.orientation, 'landscape');
        d.resize(390, 844);
        assert.equal(d.context.Sp1derDevice.orientation, 'portrait');
    });
}
test('Client Hints identifies a phone without a mobile UA', () => {
    assert.equal(detector({ hint: true }).context.Sp1derDevice.physicalPhone, true);
});
test('coarse pointer and short physical screen identify a phone in landscape', () => {
    const d = detector({ coarse: true, width: 1080, height: 540, screenWidth: 540, screenHeight: 1080 });
    assert.equal(d.context.Sp1derDevice.physicalPhone, true);
});
test('touch tablets do not become physical phones', () => {
    const d = detector({ ua: 'Mozilla/5.0 (iPad; CPU OS 18_0)', coarse: true, width: 1024, height: 768 });
    assert.equal(d.context.Sp1derDevice.phone, false);
    assert.equal(d.context.Sp1derDevice.physicalPhone, false);
});
test('desktop compact mode returns to desktop without sticky identity', () => {
    const d = detector();
    assert.equal(d.context.Sp1derDevice.phone, false);
    d.resize(375, 667);
    assert.equal(d.context.Sp1derDevice.phone, true);
    assert.equal(d.context.Sp1derDevice.physicalPhone, false);
    d.resize(1440, 900);
    assert.equal(d.context.Sp1derDevice.phone, false);
});
test('keyboard uses visual viewport height and offset, not its orientation', () => {
    const d = detector({ ua: 'iPhone', width: 390, height: 844 });
    d.document.activeElement = { matches: () => true };
    d.context.visualViewport.height = 360;
    d.context.visualViewport.offsetTop = 95;
    d.refresh();
    assert.equal(d.styles['--sp1der-vh'], '360px');
    assert.equal(d.styles['--sp1der-vtop'], '95px');
    assert.equal(d.context.Sp1derDevice.orientation, 'portrait');
    assert.equal(d.classes.has('sp1der-keyboard'), true);
    d.document.activeElement = null;
    d.refresh();
    assert.equal(d.classes.has('sp1der-keyboard'), false);
});
test('device events only fire for identity or orientation changes', () => {
    const d = detector({ ua: 'iPhone', width: 390, height: 844 });
    assert.equal(d.events.length, 1);
    d.refresh();
    assert.equal(d.events.length, 1);
    d.resize(844, 390);
    assert.equal(d.events.length, 2);
    assert.equal(d.events[1].type, 'sp1der:devicechange');
});
test('legacy media-query listeners and missing visualViewport are supported', () => {
    const d = detector({ legacy: true });
    d.context.visualViewport = null;
    d.resize(375, 667);
    assert.equal(d.styles['--sp1der-vh'], '667px');
    assert.equal(d.context.Sp1derDevice.phone, true);
});
test('every standalone entry embeds identical scripts/styles and a safe-area viewport', () => {
    for (const file of ['sp1der.html', 'sp1der-backup.html', 'sp1der-mobile.html']) {
        const html = fs.readFileSync(path.join(root, file), 'utf8');
        assert.equal(html.match(/<script id="sp1der-phone-controls">\n([\s\S]*?)\n<\/script>/)[1], script, file);
        assert.equal(html.match(/<style id="sp1der-phone-layout">\n([\s\S]*?)\n<\/style>/)[1], css, file);
        assert.match(html, /name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/);
        assert.equal((html.match(/id="sp1der-phone-controls"/g) || []).length, 1);
        assert.doesNotMatch(html, /id="sp1der-mobile-controls"|id="sp1der-mobile-layout"/);
    }
});
test('all inline Sp1der scripts have valid JavaScript syntax', () => {
    for (const file of ['sp1der.html', 'sp1der-backup.html', 'sp1der-mobile.html']) {
        const html = fs.readFileSync(path.join(root, file), 'utf8');
        for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
            if (match[1].trim()) assert.doesNotThrow(() => new vm.Script(match[1]), file);
        }
    }
});
test('generation is idempotent and current', () => {
    const result = spawnSync(process.execPath, ['scripts/build-sp1der-phone.cjs', '--check'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
});
