'use strict';

const https = require('https');
const MAX_BODY = 4096;
const MAX_RESPONSE = 65536;
const TIMEOUT = 12000;
const qualities = new Set(['144', '360', '480', '720', '1080']);
// Best-effort per-instance throttling; use platform-level protection in production.
const requestLog = new Map();
function isRateLimited(req) {
    const now = Date.now();
    for (const [ip, entry] of requestLog) if (now - entry.start > 60000) requestLog.delete(ip);
    const forwarded = req.headers && req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' && forwarded.split(',')[0].trim()) || (req.socket && req.socket.remoteAddress) || 'unknown';
    const entry = requestLog.get(ip) || { start: now, count: 0 };
    entry.count++;
    requestLog.set(ip, entry);
    return entry.count > 20;
}

// Configure an instance that you operate or have permission to use. Never accept
// the upstream address or credentials from the browser.
function getApiConfig() {
    if (!process.env.COBALT_API_URL) return null;
    try {
        const url = new URL(process.env.COBALT_API_URL);
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
        return url;
    } catch (_) { return null; }
}

function readBody(req) {
    if (req.body !== undefined) {
        try {
            const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            if (Buffer.byteLength(raw) > MAX_BODY) throw new Error('BODY_TOO_LARGE');
            return Promise.resolve(typeof req.body === 'string' ? JSON.parse(raw) : req.body);
        } catch (error) { return Promise.reject(error); }
    }
    return new Promise((resolve, reject) => {
        let body = '';
        let bytes = 0;
        req.on('data', chunk => {
            bytes += Buffer.byteLength(chunk);
            if (bytes > MAX_BODY) { reject(new Error('BODY_TOO_LARGE')); return; }
            body += chunk;
        });
        req.on('end', () => {
            try { resolve(JSON.parse(body)); } catch (_) { reject(new Error('INVALID_JSON')); }
        });
        req.on('error', reject);
    });
}

function requestCobalt(apiUrl, payload) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) };
        if (process.env.COBALT_API_KEY) headers.Authorization = 'Api-Key ' + process.env.COBALT_API_KEY;
        const request = https.request(apiUrl, { method: 'POST', headers, timeout: TIMEOUT }, response => {
            let body = '';
            let bytes = 0;
            response.on('data', chunk => {
                bytes += chunk.length;
                if (bytes > MAX_RESPONSE) { response.destroy(); reject(new Error('RESPONSE_TOO_LARGE')); return; }
                body += chunk;
            });
            response.on('error', reject);
            response.on('end', () => {
                if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error('UPSTREAM_ERROR'));
                try { resolve(JSON.parse(body)); } catch (_) { reject(new Error('INVALID_RESPONSE')); }
            });
        });
        request.on('timeout', () => request.destroy(new Error('TIMEOUT')));
        request.on('error', reject);
        request.end(data);
    });
}

module.exports = async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'طريقة الطلب غير مسموحة' });
    }
    if (isRateLimited(req)) return res.status(429).json({ error: 'طلبات كثيرة جداً، حاول بعد قليل' });
    let body;
    try { body = await readBody(req); } catch (_) {
        return res.status(400).json({ error: 'طلب غير صالح' });
    }
    if (!body || typeof body !== 'object' || typeof body.videoId !== 'string' || !/^[a-zA-Z0-9_-]{11}$/.test(body.videoId) ||
        !qualities.has(body.quality) || !['video', 'audio'].includes(body.mode)) {
        return res.status(400).json({ error: 'بيانات الفيديو غير صالحة' });
    }
    const apiUrl = getApiConfig();
    if (!apiUrl) return res.status(503).json({ error: 'خدمة تحميل الفيديو غير مهيأة حالياً. لا يزال تحميل الغلاف متاحاً.' });

    const payload = {
        url: 'https://www.youtube.com/watch?v=' + body.videoId,
        videoQuality: body.quality,
        downloadMode: body.mode === 'video' ? 'auto' : 'audio',
        audioFormat: 'mp3',
        youtubeVideoCodec: 'h264',
        youtubeVideoContainer: 'mp4',
        localProcessing: 'disabled'
    };
    try {
        const result = await requestCobalt(apiUrl, payload);
        // Only completed server-side downloads are suitable. A picker may contain
        // photos and local-processing requires client-side muxing, which we do not do.
        if (!result || !['tunnel', 'redirect'].includes(result.status) || typeof result.url !== 'string') throw new Error('UNSUPPORTED_RESPONSE');
        const download = new URL(result.url);
        if (download.protocol !== 'https:' || download.username || download.password) throw new Error('INVALID_URL');
        if (typeof result.filename !== 'string' || !result.filename.toLowerCase().endsWith(body.mode === 'video' ? '.mp4' : '.mp3')) throw new Error('UNEXPECTED_FORMAT');
        return res.status(200).json({ url: download.href });
    } catch (error) {
        console.error('youtube upstream error:', error.message);
        return res.status(502).json({ error: 'تعذر تجهيز التحميل الآن. حاول لاحقاً أو جرّب جودة أخرى.' });
    }
};
