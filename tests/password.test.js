const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const html = fs.readFileSync(path.join(__dirname, '..', 'password.html'), 'utf8');
const engine = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).find(script => script.includes('function createPassword(options)'));
const defaults = { mode: 'readable', length: 9, upper: true, lower: true, numbers: true, symbols: true };

function setup(crypto = webcrypto) {
    const elements = {};
    for (const id of ['passLength', 'passMode', 'chkUpper', 'chkLower', 'chkNumbers', 'chkSymbols', 'passLengthVal', 'passLengthBadge', 'generatedPassText', 'passStrengthBadge']) {
        elements[id] = { value: '', innerText: '', checked: true, style: {} };
    }
    elements.passLength.value = '9';
    elements.passMode.value = 'readable';
    let copies = 0;
    const context = vm.createContext({
        window: { crypto, addEventListener() {} },
        document: { getElementById: id => elements[id] },
        Uint32Array,
        copyText() { copies++; }
    });
    vm.runInContext(engine, context);
    return { context, elements, get copies() { return copies; } };
}

test('default is a readable nine-character password with capital, lowercase, two digits and symbol', () => {
    const { context, elements } = setup();
    assert.match(html, /id="passLength"[^>]*value="9"/);
    assert.match(html, /id="generatedPassText"[^>]*dir="ltr"/);
    assert.match(html, /option value="readable" selected/);
    for (let i = 0; i < 100; i++) {
        context.generateStrongPass();
        assert.match(elements.generatedPassText.innerText, /^[A-Z][a-z]{5}[0-9]{2}[!@#$%&*?]$/);
        assert.match(elements.passStrengthBadge.innerText, /لا يُنصح به للحسابات المهمة/);
    }
});

test('both modes honor all 15 nonempty combinations of character controls at all UI lengths', () => {
    const { context } = setup();
    for (const mode of ['readable', 'random']) {
        for (let length = 8; length <= 40; length++) {
            for (let mask = 1; mask < 16; mask++) {
                const options = { mode, length, upper: !!(mask & 1), lower: !!(mask & 2), numbers: !!(mask & 4), symbols: !!(mask & 8) };
                const result = context.createPassword(options);
                assert.equal(result.length, length);
                for (const [key, pattern] of [['upper', /[A-Z]/], ['lower', /[a-z]/], ['numbers', /[0-9]/], ['symbols', /[!@#$%&*?]/]]) {
                    assert.equal(pattern.test(result), options[key], `${mode}, length=${length}, mask=${mask}, ${key}`);
                }
                assert.match(result, /^[A-Za-z0-9!@#$%&*?]+$/);
                if (mode === 'readable' && options.upper && options.lower) assert.match(result, /^[A-Z][a-z]+/);
            }
        }
    }
});

test('length updates, option changes and empty selection keep output and UI in sync', () => {
    const { context, elements } = setup();
    context.syncPassLength(12);
    assert.equal(elements.generatedPassText.innerText.length, 12);
    assert.equal(elements.passLengthVal.innerText, 12);
    assert.equal(elements.passLengthBadge.innerText, '12 خانات');
    for (const type of ['Upper', 'Lower', 'Numbers', 'Symbols']) {
        assert.match(html, new RegExp(`id="chk${type}" onchange="generateStrongPass\\(\\)"`));
        elements['chk' + type].checked = false;
    }
    context.generateStrongPass();
    for (const type of ['Upper', 'Lower', 'Numbers', 'Symbols']) assert.equal(elements['chk' + type].checked, true);
    assert.match(elements.generatedPassText.innerText, /^[A-Z][a-z]{8}\d{2}[!@#$%&*?]$/);
    elements.passMode.value = 'random';
    context.syncPassLength(16);
    assert.match(elements.passStrengthBadge.innerText, /نمط عشوائي طويل/);
    assert.equal(context.createPassword({ ...defaults, length: -1 }).length, 8);
    assert.equal(context.createPassword({ ...defaults, length: 1000 }).length, 40);
});

test('secure-random failure clears stale output, prevents copying and never uses Math.random', () => {
    for (const crypto of [null, { getRandomValues() { throw new Error('unavailable'); } }]) {
        const app = setup(crypto);
        app.elements.generatedPassText.innerText = 'previous-password';
        app.context.generateStrongPass();
        assert.equal(app.elements.generatedPassText.innerText, '');
        assert.match(app.elements.passStrengthBadge.innerText, /تعذر التوليد الآمن/);
        app.context.copyGeneratedPass();
        assert.equal(app.copies, 0);
    }
    assert.doesNotMatch(engine, /Math\.random\s*\(/);
    assert.doesNotMatch(engine, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage/);
});

test('rejection sampling discards out-of-range random values', () => {
    const sequence = [0xffffffff, 17];
    let calls = 0;
    const { context } = setup({ getRandomValues(array) { array[0] = sequence[calls++]; return array; } });
    assert.equal(context.securePasswordIndex(10), 7);
    assert.equal(calls, 2);
});
