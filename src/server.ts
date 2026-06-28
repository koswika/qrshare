import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

export interface FileItem {
  name: string;
  path: string;
  size: number;
}

export interface ServerOptions {
  port: number;
  files: FileItem[];
  timeoutSeconds?: number;
  onTimeout?: () => void;
}

export function startServer(options: ServerOptions): http.Server {
  const { port, files, timeoutSeconds, onTimeout } = options;
  let timeoutId: NodeJS.Timeout | null = null;

  const server = http.createServer((req, res) => {
    const url = req.url || '/';
    const decoded = decodeURIComponent(url);

    if (decoded === '/' || decoded === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(generateHtmlListing(files));
      return;
    }

    const fileName = decoded.slice(1);
    const file = files.find(f => f.name === fileName);
    if (!file) {
      res.writeHead(404);
      res.end('File not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file.name}"`
    });

    const stream = fs.createReadStream(file.path);
    stream.pipe(res);
    stream.on('error', () => {
      res.writeHead(500);
      res.end('Error reading file');
    });
  });

  server.listen(port, () => {
    if (timeoutSeconds && timeoutSeconds > 0) {
      timeoutId = setTimeout(() => {
        console.log(`\n⏰ Timeout reached (${timeoutSeconds}s). Shutting down...`);
        if (onTimeout) onTimeout();
        server.close();
      }, timeoutSeconds * 1000);
    }
  });

  server.on('close', () => {
    if (timeoutId) clearTimeout(timeoutId);
  });

  return server;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateHtmlListing(files: FileItem[]): string {
  const rows = files.map(file => `
    <tr>
      <td>📄 ${escapeHtml(file.name)}</td>
      <td>${formatBytes(file.size)}</td>
      <td><a href="/${encodeURIComponent(file.name)}">Download</a></td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head><title>QRShare</title><style>
body{font-family:sans-serif;max-width:800px;margin:50px auto;padding:20px}
table{width:100%;border-collapse:collapse}
th,td{padding:10px;text-align:left;border-bottom:1px solid #ddd}
a{background:#007bff;color:white;padding:5px 10px;text-decoration:none;border-radius:3px}
a:hover{background:#0056b3}
</style></head>
<body>
<h1>📁 QRShare – Files ready to download</h1>
<table><tr><th>File</th><th>Size</th><th>Action</th></tr>${rows}</table>
<p>🔒 This server will close automatically after ${files.length > 0 ? 'download or timeout' : 'no activity'}.</p>
</body></html>`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}