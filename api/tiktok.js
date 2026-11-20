'use strict';

const https = require('https');

// ──────────────────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────────────────
const TIKWM_HOST = 'www.tikwm.com';
const TIKWM_PATH = '/api/';
const REQUEST_TIMEOUT_MS = 8000;        // Must stay below vercel.json's maxDuration (10s)
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB cap – protects against memory exhaustion
const MAX_URL_LENGTH = 500;
const MAX_QUALITY_LENGTH = 10;

// Allowlist: only accept well-formed TikTok links. Anything else is rejected
// outright instead of being forwarded to the upstream API.
const TIKTOK_URL_PATTERN = /^https:\/\/(www\.|vt\.|vm\.|m\.)?tiktok\.com\/[^\s<>"']+$/i;

// Allowed response formats for the quality param.
const ALLOWED_QUALITIES = new Set(['', '144', '360', '480', '720', '1080']);

// ──────────────────────────────────────────────────────────────────────────
// Best-effort in-memory rate limiter
//
// IMPORTANT LIMITATION: Vercel serverless functions are stateless across
// cold starts, regions and concurrent instances. This Map only throttles
// requests hitting the SAME warm instance, so it raises the bar against
// casual abuse/loops but is NOT a substitute for real DDoS protection.
// For actual protection against volumetric attacks, enable Vercel's
// Firewall / Attack Challenge Mode (Pro/Enterprise plan) or put the
// deployment behind Cloudflare. For a rate limiter that works correctly
// across all instances, use a shared store (Upstash Redis / Vercel KV).
// ──────────────────────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const requestLog = new Map(); // ip -> { count, windowStart }

function isRateLimited(clientIp) {
    const now = Date.now();
    const entry = requestLog.get(clientIp);

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        requestLog.set(clientIp, { count: 1, windowStart: now });
        return false;
    }

    entry.count += 1;
    return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

// Drop stale entries so the Map doesn't grow unbounded on a long-lived warm instance.
function pruneRequestLog() {
    const now = Date.now();
    for (const [ip, entry] of requestLog) {
        if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
            requestLog.delete(ip);
        }
    }
}

function getClientIp(req) {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
        return forwardedFor.split(',')[0].trim();
    }
    return (req.socket && req.socket.remoteAddress) || 'unknown';
}

// ──────────────────────────────────────────────────────────────────────────
// Outbound request to the TikTok extraction API
// ──────────────────────────────────────────────────────────────────────────
function fetchFromTikwm(targetUrl, quality) {
    return new Promise((resolve, reject) => {
        // tikwm only exposes two renditions per video: standard ("play") and HD ("hdplay").
        // 720/1080 -> request HD, everything else -> standard.
        const wantHd = quality === '720' || quality === '1080';
        const requestPath = `${TIKWM_PATH}?url=${encodeURIComponent(targetUrl)}&hd=${wantHd ? 1 : 0}`;

        const request = https.get(
            {
                hostname: TIKWM_HOST,
                path: requestPath,
                headers: { 'User-Agent': 'NexusUltra/1.0' },
                timeout: REQUEST_TIMEOUT_MS,
            },
            (apiRes) => {
                let responseBody = '';
                let totalBytes = 0;
                let aborted = false;

                apiRes.on('data', (chunk) => {
                    totalBytes += chunk.length;
                    if (totalBytes > MAX_RESPONSE_BYTES) {
                        aborted = true;
                        apiRes.destroy();
                        reject(new Error('UPSTREAM_RESPONSE_TOO_LARGE'));
                        return;
                    }
                    responseBody += chunk;
                });

                apiRes.on('end', () => {
                    if (!aborted) resolve({ body: responseBody, statusCode: apiRes.statusCode });
                });

                apiRes.on('error', (err) => {
                    if (!aborted) reject(err);
                });
            }
        );

        request.on('timeout', () => {
            request.destroy(new Error('UPSTREAM_TIMEOUT'));
        });

        request.on('error', (err) => reject(err));
    });
}

// ──────────────────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
    // Defense in depth: these are also set globally in vercel.json.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.status(405).json({ error: 'طريقة الطلب غير مسموحة' });
        return;
    }

    const clientIp = getClientIp(req);
    pruneRequestLog();
    if (isRateLimited(clientIp)) {
        res.status(429).json({ error: 'طلبات كثيرة جداً، حاول بعد قليل' });
        return;
    }

    const url = req.query.url;
    const quality = req.query.quality || req.query.hd || '';

    if (!url || Array.isArray(url) || typeof url !== 'string') {
        res.status(400).json({ error: 'رابط الفيديو مطلوب' });
        return;
    }

    if (url.length > MAX_URL_LENGTH) {
        res.status(400).json({ error: 'الرابط طويل جداً' });
        return;
    }

    if (!TIKTOK_URL_PATTERN.test(url)) {
        res.status(400).json({ error: 'الرابط ليس رابط تيك توك صحيح' });
        return;
    }

    // Validate quality parameter
    let q = '';
    if (quality) {
        if (!ALLOWED_QUALITIES.has(quality)) {
            res.status(400).json({ error: 'جودة غير مدعومة. القيم المقبولة: 144, 360, 480, 720, 1080' });
            return;
        }
        q = quality;
    }

    try {
        const upstreamResponse = await fetchFromTikwm(url, q);

        let parsedBody;
        try {
            parsedBody = JSON.parse(upstreamResponse.body);
        } catch (parseError) {
            console.error('tiktok.js: upstream returned non-JSON response');
            res.status(502).json({ error: 'تعذر معالجة استجابة الخدمة الخارجية' });
            return;
        }

        const safeStatusCode =
            Number.isInteger(upstreamResponse.statusCode) &&
            upstreamResponse.statusCode >= 200 &&
            upstreamResponse.statusCode < 600
                ? upstreamResponse.statusCode
                : 502;

        res.setHeader('Content-Type', 'application/json');
        res.status(safeStatusCode).json(parsedBody);
    } catch (error) {
        // Never leak internal error details (stack traces, hostnames) to the client.
        console.error('tiktok.js upstream error:', error && error.message);

        if (error && error.message === 'UPSTREAM_TIMEOUT') {
            res.status(504).json({ error: 'انتهت مهلة الاتصال بالخدمة الخارجية' });
            return;
        }
        if (error && error.message === 'UPSTREAM_RESPONSE_TOO_LARGE') {
            res.status(502).json({ error: 'استجابة الخدمة الخارجية كبيرة جداً' });
            return;
        }
        res.status(502).json({ error: 'تعذر الاتصال بالخدمة الخارجية، حاول لاحقاً' });
    }
};
