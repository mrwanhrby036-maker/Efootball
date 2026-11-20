const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

let server;
let port;
const root = path.join(__dirname, '..');

before(async () => {
    server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
        let output = '';
        server.on('error', reject);
        server.on('exit', () => { clearTimeout(timeout); reject(new Error('Server exited')); });
        server.stdout.on('data', data => {
            output += data;
            const match = output.match(/0\.0\.0\.0:(\d+)/);
            if (match) { port = Number(match[1]); clearTimeout(timeout); resolve(); }
        });
    });
});
after(async () => {
    if (server && server.exitCode === null) {
        const exited = once(server, 'exit');
        server.kill();
        await exited;
    }
});

function request(urlPath, method = 'GET') {
    return new Promise((resolve, reject) => {
        http.request({ hostname: '127.0.0.1', port, path: urlPath, method }, res => {
            let bytes = 0;
            res.on('data', data => { bytes += data.length; });
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, bytes }));
        }).on('error', reject).end();
    });
}

test('public pages, clean URLs, and MP4 remain accessible', async () => {
    for (const route of ['/', '/keyboard-fixer', '/keyboard-fixer.html', '/password', '/ads.txt', '/sitemap.xml']) {
        assert.equal((await request(route)).status, 200, route);
    }
    const video = await request('/assets/videos/neural-plexus-seamless-loop.mp4');
    assert.equal(video.status, 200);
    assert.equal(video.headers['content-type'], 'video/mp4');
    assert.equal(video.bytes, 2759481);
    const adInitializer = await request('/assets/js/ads.js');
    assert.equal(adInitializer.status, 200);
    assert.equal(adInitializer.headers['content-type'], 'application/javascript; charset=utf-8');
    const head = await request('/keyboard-fixer', 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.bytes, 0);
});

test('credentials, server sources, metadata, and traversal paths are not public', async () => {
    for (const route of ['/.env', '/.env.example', '/.env.production', '/.git/HEAD', '/server.js', '/api/tiktok.js', '/package.json', '/vercel.json', '/tests/keyboard-fixer.test.js', '/../package.json', '/%2e%2e/package.json', '/assets/../server.js', '/assets/%2e%2e/server.js', '/assets%5c..%5cserver.js', '/%00']) {
        const result = await request(route);
        assert.equal(result.status, 404, route);
        assert.equal(result.headers['x-content-type-options'], 'nosniff');
    }
});

test('symlinks cannot expose server files through public assets', async () => {
    const link = path.join(root, 'assets', `audit-${process.pid}.js`);
    fs.symlinkSync(path.join(root, 'server.js'), link);
    try {
        assert.equal((await request(`/assets/audit-${process.pid}.js`)).status, 404);
    } finally {
        fs.unlinkSync(link);
    }
});

test('malformed URI and unsupported method do not crash the server', async () => {
    assert.equal((await request('/%E0%A4%A')).status, 400);
    assert.equal((await request('/', 'POST')).status, 405);
    assert.equal((await request('/')).status, 200);
});

test('API executes without exposing its source and handles invalid requests locally', async () => {
    assert.equal((await request('/api/tiktok')).status, 400);
    assert.equal((await request('/api/tiktok', 'POST')).status, 405);
});
