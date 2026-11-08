/* Inline phone assets so raw-HTML runners and direct URLs behave identically. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = ['sp1der.html', 'sp1der-backup.html', 'sp1der-mobile.html'];
const css = fs.readFileSync(path.join(root, 'mobile/sp1der-phone.css'), 'utf8').trim();
const js = fs.readFileSync(path.join(root, 'mobile/sp1der-phone.js'), 'utf8').trim();
const block = '<!-- sp1der-phone:start -->\n<script id="sp1der-phone-controls">\n' + js +
    '\n</script>\n<style id="sp1der-phone-layout">\n' + css + '\n</style>\n<!-- sp1der-phone:end -->';
let stale = false;
for (const file of files) {
    const full = path.join(root, file);
    const before = fs.readFileSync(full, 'utf8');
    let html = before
        .replace(/<!-- sp1der-phone:start -->[\s\S]*?<!-- sp1der-phone:end -->\s*/g, '')
        .replace(/<script id="sp1der-mobile-controls">[\s\S]*?<\/script>\s*/g, '')
        .replace(/<style id="sp1der-mobile-layout">([\s\S]*?)<\/style>/g, (_, legacy) => {
            // The legacy mobile copy also carries its palette here. Preserve only that palette.
            return '<style id="default-dark-blue">' + legacy.slice(0, legacy.indexOf('\n')) + '</style>';
        })
        .replace(/<meta name="viewport" content="[^"]*">/, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
    if (!/<\/head>/i.test(html)) throw new Error('Missing head in ' + file);
    html = html.replace('</head>', block + '\n</head>');
    if (html !== before) {
        stale = true;
        if (!process.argv.includes('--check')) fs.writeFileSync(full, html);
        console.log((process.argv.includes('--check') ? 'Stale: ' : 'Updated: ') + file);
    }
}
if (process.argv.includes('--check') && stale) process.exitCode = 1;
