const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const tiktokHandler = require('./api/tiktok.js');

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // API route handling
    if (pathname === '/api/tiktok') {
        req.query = parsedUrl.query;
        return tiktokHandler(req, res);
    }

    // Clean URLs handling (emulates Vercel cleanUrls: true)
    let filePath;
    if (pathname === '/' || pathname === '') {
        filePath = path.join(ROOT, 'index.html');
    } else {
        filePath = path.join(ROOT, pathname);
    }

    fs.stat(filePath, (err, stats) => {
        if (!err && stats.isFile()) {
            return serveFile(filePath, res);
        }

        // Try with .html extension for cleanUrls
        const htmlPath = filePath + '.html';
        fs.stat(htmlPath, (err2, stats2) => {
            if (!err2 && stats2.isFile()) {
                return serveFile(htmlPath, res);
            }

            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>404 Not Found</h1><p><a href="/">العودة إلى الصفحة الرئيسية</a></p>');
        });
    });
});

function serveFile(filePath, res) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server Error');
            return;
        }
        res.writeHead(200, {
            'Content-Type': contentType,
            'X-Content-Type-Options': 'nosniff'
        });
        res.end(data);
    });
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
