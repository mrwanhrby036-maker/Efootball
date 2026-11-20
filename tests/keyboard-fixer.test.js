const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'keyboard-fixer.html'), 'utf8');
const engine = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).find(script => script.includes('var enToArMap ='));

function createEngine() {
    const elements = {};
    for (const id of ['inputKeyboardText', 'outputKeyboardText', 'detectedBadge', 'timeSaved', 'fixCapsLock', 'inCharCount', 'inWordCount', 'outCharCount']) {
        elements[id] = { value: '', innerText: '', checked: true, style: {} };
    }
    const context = vm.createContext({
        document: { getElementById: id => elements[id], querySelectorAll: () => [] },
        window: { addEventListener() {} },
        showToast() {}, setTimeout, clearTimeout
    });
    vm.runInContext(engine, context);
    return { context, elements, convert(text, mode = 'auto') {
        context.currentMode = mode;
        elements.inputKeyboardText.value = text;
        context.runKeyboardFix();
        return elements.outputKeyboardText.value;
    } };
}

test('every inline script and structured data block has valid syntax', () => {
    for (const name of fs.readdirSync(root).filter(name => name.endsWith('.html'))) {
        const text = fs.readFileSync(path.join(root, name), 'utf8');
        for (const match of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
            if (match[1].includes('application/ld+json')) JSON.parse(match[2]);
            else new vm.Script(match[2], { filename: name });
        }
    }
});

test('default example converts exactly to الحمد لله رب العالمين', () => {
    const raw = html.match(/<textarea id="inputKeyboardText"[^>]*>([^<]*)<\/textarea>/)[1];
    const { convert } = createEngine();
    assert.equal(raw, 'hgpl] ggi vf hguhgldk');
    assert.equal(convert(raw), 'الحمد لله رب العالمين');
    assert.equal(convert(raw.toUpperCase()), 'الحمد لله رب العالمين');
    assert.equal(convert('الحمد لله رب العالمين', 'ar-to-en'), raw);
});

test('letter mapping stays faithful, rather than silently rewriting user words', () => {
    const { convert } = createEngine();
    assert.equal(convert('vf', 'en-to-ar'), 'رب');
    assert.equal(convert('vj', 'en-to-ar'), 'رت');
    assert.equal(convert('b', 'en-to-ar'), 'لا');
    assert.equal(convert('لا', 'ar-to-en'), 'b');
    assert.equal(convert('hgpl]\nggi 123 😀', 'en-to-ar'), 'الحمد\nلله 123 😀');
    assert.equal(convert(''), '');
});

test('every preset produces exactly the label shown to visitors', () => {
    const { context, elements } = createEngine();
    const pattern = /class="preset-chip" onclick="loadPreset\('([^']*)'\)">\s*<code>[^<]*<\/code>\s*<span class="chip-arrow">➔<\/span>\s*<span>([^<]*)<\/span>/g;
    const presets = [...html.matchAll(pattern)];
    assert.equal(presets.length, 8);
    for (const [, raw, expected] of presets) {
        context.loadPreset(raw);
        assert.equal(elements.outputKeyboardText.value, expected);
    }
});

test('conversion engine has no automatic network or persistence calls', () => {
    assert.doesNotMatch(engine, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage/);
    assert.doesNotMatch(html, /getElementById\('charTester'\)/);
});
