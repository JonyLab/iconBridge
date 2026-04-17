/**
 * IconBridge — Cloudflare Worker CORS Proxy
 *
 * 部署方法：
 *   1. 登录 https://dash.cloudflare.com → Workers & Pages → Create Worker
 *   2. 把本文件内容粘贴进去，Save and Deploy
 *   3. 复制 Worker URL（形如 https://xxx.workers.dev）
 *   4. 填入插件设置的"代理地址"字段
 */

const TARGET = 'https://www.iconfont.cn';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Cookie, Referer',
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(request.url);
  const target = TARGET + url.pathname + url.search;

  const headers = new Headers(request.headers);
  // Rename X-Cookie → Cookie (browsers cannot set Cookie directly)
  if (headers.has('x-cookie')) {
    headers.set('cookie', headers.get('x-cookie'));
    headers.delete('x-cookie');
  }
  headers.set('host', 'www.iconfont.cn');

  const upstream = await fetch(target, {
    method: request.method,
    headers: headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
  });

  const resHeaders = new Headers(upstream.headers);
  for (const key in CORS) resHeaders.set(key, CORS[key]);
  resHeaders.delete('transfer-encoding');

  return new Response(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}
