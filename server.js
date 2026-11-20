const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = fs.realpathSync(__dirname);
const PUBLIC_PAGES = new Set(fs.readdirSync(ROOT).filter(name => /^[a-z0-9-]+\.html$/.test(name)));
const PUBLIC_FILES = new Set(['ads.txt', 'sitemap.xml', 'robots.txt', 'favicon.ico']);
const ASSET_EXTENSIONS = new Set(['.css', '.js', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.mp4', '.woff', '.woff2']);

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

const tiktokHandler = require('./api/tiktok.js');

function isPublicFile(relativePath) {
    const segments = relativePath.split('/');
    if (segments.some(segment => !segment || segment.startsWith('.'))) return false;
    if (relativePath.includes('\\') || relativePath.includes('\0')) return false;
    return PUBLIC_PAGES.has(relativePath) || PUBLIC_FILES.has(relativePath) ||
        (segments[0] === 'assets' && ASSET_EXTENSIONS.has(path.extname(relativePath).toLowerCase()));
}

function notFound(res) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('Not Found');
}

const server = http.createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const parsedUrl = url.parse(req.url, true);
    let pathname;
    try {
        pathname = decodeURIComponent(parsedUrl.pathname);
    } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Bad Request');
        return;
    }

    // API handlers execute on the server; their source is never a static asset.
    if (pathname === '/api/tiktok') {
        req.query = parsedUrl.query;
        res.status = code => { res.statusCode = code; return res; };
        res.json = data => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(data));
        };
        return tiktokHandler(req, res);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        res.end('Method Not Allowed');
        return;
    }

    let relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (/^[a-z0-9-]+$/.test(relativePath)) relativePath += '.html';
    if (!isPublicFile(relativePath)) return notFound(res);

    const filePath = path.resolve(ROOT, relativePath);
    fs.realpath(filePath, (err, realPath) => {
        if (err) return notFound(res);
        // Revalidate after resolving symlinks, including links to private files inside ROOT.
        const resolvedRelative = path.relative(ROOT, realPath).split(path.sep).join('/');
        if (!isPublicFile(resolvedRelative)) return notFound(res);
        fs.stat(realPath, (statError, stats) => {
            if (statError || !stats.isFile()) return notFound(res);
            serveFile(realPath, req, res);
        });
    });
});

function serveFile(filePath, req, res) {
    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()];
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server Error');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': data.length });
        res.end(req.method === 'HEAD' ? undefined : data);
    });
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${server.address().port}`);
});
