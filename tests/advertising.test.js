const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/js/ads.js'), 'utf8');
const bannerSource = fs.readFileSync(path.join(root, 'assets/js/banner.js'), 'utf8');

function setup(provider, withSlot = true) {
    const scripts = [];
    const warnings = [];
    const slot = {
        id: 'nexus-banner', dataset: {}, children: [],
        appendChild(script) { script.parentNode = this; this.children.push(script); }
    };
    const document = {
        currentScript: null,
        getElementById: id => id === 'nexus-banner' ? (withSlot ? slot : null) : scripts.find(script => script.id === id),
        createElement: () => ({}),
        head: { appendChild: script => scripts.push(script) }
    };
    const context = vm.createContext({ window: { aclib: provider }, document, console: { warn: message => warnings.push(message) } });
    return {
        scripts, warnings, context, slot,
        run() { vm.runInContext(source, context); },
        runCaller() {
            document.currentScript = slot.children[0];
            try { vm.runInContext(bannerSource, context); }
            finally { document.currentScript = null; }
        }
    };
}

test('all twelve pages have one deferred loader and a fixed banner before the hero or tool', () => {
    const pages = fs.readdirSync(root).filter(name => name.endsWith('.html'));
    assert.equal(pages.length, 12);
    for (const name of pages) {
        const html = fs.readFileSync(path.join(root, name), 'utf8');
        assert.equal((html.match(/<script defer src="\/assets\/js\/ads\.js"><\/script>/g) || []).length, 1, name);
        assert.equal((html.match(/id="nexus-banner"/g) || []).length, 1, name);
        assert.match(html, /<aside class="ad-banner" aria-label="إعلان">/);
        const panel = name === 'index.html' ? '<section class="hero-section">' : '<section class="tool-panel">';
        assert(html.indexOf('id="nexus-banner"') < html.indexOf(panel), name);
        assert.doesNotMatch(html, /adsbygoogle|data-ad-client|data-ad-slot|runAutoTag/, name);
        assert.match(html, /name="google-site-verification"/, name);
    }
    assert.doesNotMatch(source + bannerSource, /runAutoTag|cojloeaark/);
});

test('SDK loads once over HTTPS and the banner caller waits for SDK load', () => {
    const app = setup({ runBanner() {} });
    app.run(); app.run();
    assert.equal(app.scripts.length, 1);
    assert.equal(app.scripts[0].id, 'aclib');
    assert.equal(app.scripts[0].src, 'https://acscdn.com/script/aclib.js');
    assert.equal(app.scripts[0].async, true);
    assert.equal(app.slot.children.length, 0);
    app.scripts[0].onload(); app.scripts[0].onload();
    assert.equal(app.slot.children.length, 1);
    assert.equal(app.slot.children[0].src, '/assets/js/banner.js');
});

test('runBanner uses the exact supplied zone and executes in the visible slot, not the head', () => {
    const calls = [];
    const app = setup({ runBanner(options) {
        calls.push(options);
        assert.equal(app.context.document.currentScript.parentNode.id, 'nexus-banner');
    } });
    app.run(); app.scripts[0].onload();
    assert.equal(calls.length, 0);
    app.runCaller(); app.runCaller();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].zoneId, '12474522');
    assert.deepEqual(Object.keys(calls[0]), ['zoneId']);
    assert.equal(app.slot.dataset.adState, 'requested');
});

test('pages without a banner slot do not load the advertising SDK', () => {
    const app = setup({ runBanner() {} }, false);
    app.run();
    assert.equal(app.scripts.length, 0);
});

test('missing provider or blocked SDK does not interrupt the tools', () => {
    const missing = setup(); missing.run();
    assert.doesNotThrow(() => missing.scripts[0].onload());
    assert.equal(missing.slot.dataset.adState, 'unavailable');
    assert.equal(missing.slot.children.length, 0);
    const blocked = setup(); blocked.run();
    assert.doesNotThrow(() => blocked.scripts[0].onerror());
    assert.equal(blocked.slot.dataset.adState, 'unavailable');
    assert.match(blocked.warnings[0], /failed to load or was blocked/);
});

test('caller load errors and provider exceptions are contained without leaking details', () => {
    const app = setup({ runBanner() { throw new Error('sensitive-provider-details'); } });
    app.run(); app.scripts[0].onload();
    assert.doesNotThrow(() => app.runCaller());
    assert.equal(app.slot.dataset.adState, 'unavailable');
    assert.equal(app.warnings[0], 'Banner: initialization failed.');
    assert.doesNotMatch(app.warnings.join(''), /sensitive-provider-details/);
    const blockedCaller = setup({ runBanner() {} }); blockedCaller.run(); blockedCaller.scripts[0].onload();
    assert.doesNotThrow(() => blockedCaller.slot.children[0].onerror());
    assert.equal(blockedCaller.slot.dataset.adState, 'unavailable');
});

test('CSP explicitly allows the SDK host without broadly trusting all scripts or disabling protection', () => {
    const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
    const csp = config.headers[0].headers.find(header => header.key === 'Content-Security-Policy').value;
    for (const name of ['script-src', 'connect-src', 'frame-src']) {
        const directive = csp.split(';').map(value => value.trim()).find(value => value.startsWith(name + ' '));
        assert(directive.split(' ').includes('https://acscdn.com'), name);
        assert(!directive.split(' ').includes('*'), name);
        assert(!directive.split(' ').includes('https:'), name);
    }
    assert(csp.includes("object-src 'none'"));
    assert(csp.includes("frame-ancestors 'none'"));
    assert.doesNotMatch(csp, /googlesyndication|doubleclick|adtrafficquality/);
});
