#!/usr/bin/env node
/**
 * Iconfont Replacer — 本地 CORS 代理
 * 将请求转发到 www.iconfont.cn 并补充 CORS 响应头。
 * 使用方法：node proxy.js
 */
const http = require('http');
const https = require('https');

const PORT = 17788;
const TARGET_HOST = 'www.iconfont.cn';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Cookie, Referer',
};

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);

    const options = {
      hostname: TARGET_HOST,
      port: 443,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: TARGET_HOST },
    };

    const proxyReq = https.request(options, proxyRes => {
      const headers = { ...proxyRes.headers, ...CORS_HEADERS };
      delete headers['transfer-encoding'];
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', err => {
      res.writeHead(502, CORS_HEADERS);
      res.end(JSON.stringify({ code: 502, message: err.message }));
    });

    if (body.length > 0) proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ Iconfont 代理已启动：http://localhost:${PORT}`);
  console.log('   保持此窗口运行，然后打开 Figma 插件。');
  console.log('   按 Ctrl+C 停止。');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ 端口 ${PORT} 已被占用，请关闭占用进程后重试。`);
  } else {
    console.error('❌ 代理启动失败：', err.message);
  }
  process.exit(1);
});
