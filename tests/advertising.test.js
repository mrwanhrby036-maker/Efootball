const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/js/ads.js'), 'utf8');

function setup(provider) {
    const scripts = [];
    const warnings = [];
    const context = vm.createContext({
        window: { aclib: provider },
        document: {
            getElementById: id => scripts.find(script => script.id === id),
            createElement: () => ({}),
            head: { appendChild: script => scripts.push(script) }
        },
        console: { warn: message => warnings.push(message) }
    });
    return { scripts, warnings, context, run() { vm.runInContext(source, context); } };
}

test('all twelve pages use one deferred shared initializer instead of AdSense markup', () => {
    const pages = fs.readdirSync(root).filter(name => name.endsWith('.html'));
    assert.equal(pages.length, 12);
    for (const name of pages) {
        const html = fs.readFileSync(path.join(root, name), 'utf8');
        assert.equal((html.match(/<script defer src="\/assets\/js\/ads\.js"><\/script>/g) || []).length, 1, name);
        assert.doesNotMatch(html, /adsbygoogle|data-ad-client|data-ad-slot|ad-banner/, name);
        // Search verification remains independent from the advertising integration.
        assert.match(html, /name="google-site-verification"/, name);
    }
});

test('SDK is HTTPS, loaded once, and initialization waits for the load event', () => {
    const calls = [];
    const app = setup({ runAutoTag: options => calls.push(options) });
    app.run();
    app.run();
    assert.equal(app.scripts.length, 1);
    assert.equal(app.scripts[0].id, 'aclib');
    assert.equal(app.scripts[0].src, 'https://acscdn.com/script/aclib.js');
    assert.equal(app.scripts[0].async, true);
    assert.equal(calls.length, 0);
    app.scripts[0].onload();
    app.scripts[0].onload();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].zoneId, 'cojloeaark');
    assert.deepEqual(Object.keys(calls[0]), ['zoneId']);
});

test('missing provider, blocked SDK, and provider exceptions do not break the page', () => {
    const missing = setup();
    missing.run();
    assert.doesNotThrow(() => missing.scripts[0].onload());
    assert.equal(missing.warnings.length, 1);
    const blocked = setup();
    blocked.run();
    assert.doesNotThrow(() => blocked.scripts[0].onerror());
    assert.match(blocked.warnings[0], /failed to load or was blocked/);
    const throwing = setup({ runAutoTag() { throw new Error('sensitive-provider-details'); } });
    throwing.run();
    assert.doesNotThrow(() => throwing.scripts[0].onload());
    assert.equal(throwing.warnings[0], 'AutoTag: initialization failed.');
    assert.doesNotMatch(throwing.warnings.join(''), /sensitive-provider-details/);
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
