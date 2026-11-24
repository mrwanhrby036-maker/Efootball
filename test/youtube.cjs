'use strict';
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const handler = require('../api/youtube');
const originalRequest = https.request;
const valid = { videoId: 'dQw4w9WgXcQ', quality: '720', mode: 'video' };
let counter = 0;
function call(body, method = 'POST') {
    const req = { method, body, headers: { 'x-forwarded-for': 'test-' + counter++ } };
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    return handler(req, res).then(() => res);
}
function mockCobalt(result, code = 200) {
    let captured = {};
    https.request = (url, options, callback) => {
        captured.url = url.href; captured.options = options;
        const req = new EventEmitter();
        req.end = data => {
            captured.payload = JSON.parse(data);
            const response = new EventEmitter(); response.statusCode = code; response.destroy = () => {};
            callback(response);
            process.nextTick(() => { response.emit('data', Buffer.from(JSON.stringify(result))); response.emit('end'); });
        };
        return req;
    };
    return captured;
}
afterEach(() => { https.request = originalRequest; delete process.env.COBALT_API_URL; delete process.env.COBALT_API_KEY; });
test('requires a configured instance and validates input', async () => {
    assert.equal((await call(valid)).code, 503);
    assert.equal((await call({ ...valid, videoId: 'bad' })).code, 400);
    assert.equal((await call({ ...valid, mode: 'mute' })).code, 400);
    assert.equal((await call(valid, 'GET')).code, 405);
});
test('requests merged H264 MP4 and uses the returned tunnel', async () => {
    process.env.COBALT_API_URL = 'https://cobalt.example/'; process.env.COBALT_API_KEY = 'secret';
    const captured = mockCobalt({ status: 'tunnel', url: 'https://cobalt.example/tunnel?id=1', filename: 'video.mp4' });
    const res = await call(valid);
    assert.equal(res.code, 200); assert.equal(res.data.url, 'https://cobalt.example/tunnel?id=1');
    assert.deepEqual(captured.payload, { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoQuality: '720', downloadMode: 'auto', audioFormat: 'mp3', youtubeVideoCodec: 'h264', youtubeVideoContainer: 'mp4', localProcessing: 'disabled' });
    assert.equal(captured.options.headers.Authorization, 'Api-Key secret');
});
test('audio is a separate MP3 request', async () => {
    process.env.COBALT_API_URL = 'https://cobalt.example/';
    const captured = mockCobalt({ status: 'redirect', url: 'https://cobalt.example/audio', filename: 'audio.mp3' });
    assert.equal((await call({ ...valid, mode: 'audio' })).code, 200);
    assert.equal(captured.payload.downloadMode, 'audio');
});
test('rejects photos, unmerged streams, incorrect formats, insecure URLs and upstream errors', async () => {
    process.env.COBALT_API_URL = 'https://cobalt.example/';
    for (const result of [
        { status: 'picker', picker: [{ type: 'photo', url: 'https://example.com/a.jpg' }] },
        { status: 'local-processing', url: 'https://example.com/video' },
        { status: 'tunnel', url: 'https://example.com/audio', filename: 'audio.mp3' },
        { status: 'redirect', url: 'http://example.com/video', filename: 'video.mp4' },
        { status: 'error', url: 'https://example.com/video' }
    ]) { mockCobalt(result); assert.equal((await call(valid)).code, 502); }
    mockCobalt({ status: 'tunnel', url: 'https://example.com/video' }, 500);
    assert.equal((await call(valid)).code, 502);
});

test('browser resets stale results and requests the selected video and quality', async () => {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const html = fs.readFileSync('youtube.html', 'utf8');
    const script = html.match(/<script>\s*(var selectedYouTubeVideo = null;[\s\S]*?)<\/script>/)[1];
    const elements = {};
    for (const id of ['youtubeInputUrl', 'youtubeQuality', 'youtubeResultCard', 'ytCover', 'ytTitle', 'ytVideoId', 'ytDownloadThumb', 'ytDownloadStatus', 'ytDownloadVideo', 'ytDownloadAudio']) elements[id] = { style: {} };
    elements.youtubeInputUrl.value = 'https://www.youtube.com/watch?t=1&v=dQw4w9WgXcQ';
    elements.youtubeQuality.value = '480';
    let sent, destination;
    const context = { URL, document: { getElementById: id => elements[id] }, showToast() {}, isSafeHttpUrl: url => /^https?:\/\//.test(url), window: { location: { assign: url => { destination = url; } } }, fetch: async (url, options) => { sent = { url, body: JSON.parse(options.body) }; return { ok: true, json: async () => ({ url: 'https://example.com/file' }) }; } };
    vm.createContext(context); vm.runInContext(script, context);
    context.processYouTubeVideo();
    assert.equal(elements.youtubeResultCard.style.display, 'grid');
    await context.downloadYouTubeMedia('video');
    assert.equal(sent.url, '/api/youtube');
    assert.equal(sent.body.videoId, 'dQw4w9WgXcQ'); assert.equal(sent.body.quality, '480'); assert.equal(sent.body.mode, 'video');
    assert.equal(destination, 'https://example.com/file');
    elements.youtubeInputUrl.value = 'https://notyoutube.com/watch?v=dQw4w9WgXcQ';
    context.processYouTubeVideo();
    assert.equal(elements.youtubeResultCard.style.display, 'none');
    assert.equal(context.selectedYouTubeVideo, null);
});
