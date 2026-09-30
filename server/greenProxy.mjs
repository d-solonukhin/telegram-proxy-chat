import https from 'node:https';

const HOST_RE = /^(?:[a-z0-9-]+\.)*green-api\.com$/i;
const ALLOWED_METHODS = new Set(['GET', 'POST', 'DELETE']);
const MAX_BODY = 64 * 1024;
const MAX_RESPONSE = 2 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 70_000;

const PREFIXES = [
  '/green-api/',
  '/api/green-api/',
  '/.netlify/functions/green-api/',
];

const agent = new https.Agent({ keepAlive: true, maxSockets: 20 });

/**
 * @param {string | undefined} input path + query, any of the known proxy prefixes
 * @returns {{ host: string, path: string } | null}
 */
export function parseProxyUrl(input) {
  if (!input || typeof input !== 'string') return null;
  let value = input;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const url = new URL(value);
      value = url.pathname + url.search;
    } catch {
      return null;
    }
  }
  const hash = value.indexOf('#');
  const clean = hash === -1 ? value : value.slice(0, hash);
  const qIndex = clean.indexOf('?');
  const pathname = qIndex === -1 ? clean : clean.slice(0, qIndex);
  const search = qIndex === -1 ? '' : clean.slice(qIndex);

  let rest = null;
  for (const prefix of PREFIXES) {
    if (pathname.startsWith(prefix)) {
      rest = pathname.slice(prefix.length);
      break;
    }
  }
  if (rest == null || rest.length === 0) return null;

  const slash = rest.indexOf('/');
  const hostRaw = slash === -1 ? rest : rest.slice(0, slash);
  let host = hostRaw;
  try {
    host = decodeURIComponent(hostRaw);
  } catch {
    return null;
  }
  host = host.toLowerCase();
  if (!HOST_RE.test(host) || host.includes('..') || host.startsWith('.') || host.endsWith('.')) {
    return null;
  }

  const path = (slash === -1 ? '/' : rest.slice(slash)) + search;
  if (!path.startsWith('/') || path.includes('\\') || path.includes('\0')) return null;
  return { host, path };
}

/**
 * @param {import('node:http').IncomingMessage} req
 */
export function targetFromNodeRequest(req) {
  const fromUrl = parseProxyUrl(req.url || '');
  if (fromUrl) return fromUrl;

  const query = req.query;
  const pathParam = query && query.path;
  if (!Array.isArray(pathParam) || pathParam.length === 0) return null;
  const host = String(pathParam[0] ?? '');
  const rest = `/${pathParam.slice(1).map((part) => String(part)).join('/')}`;
  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (key === 'path') continue;
      if (Array.isArray(value)) {
        for (const item of value) params.append(key, String(item));
      } else if (value != null) {
        params.append(key, String(value));
      }
    }
  }
  const qs = params.toString();
  return parseProxyUrl(`/green-api/${host}${rest}${qs ? `?${qs}` : ''}`);
}

/**
 * @param {{
 *   method: string,
 *   host: string,
 *   path: string,
 *   body?: Buffer,
 *   contentType?: string | null,
 *   signal?: AbortSignal,
 * }} options
 * @returns {Promise<{ status: number, contentType: string | null, body: Buffer }>}
 */
export function forwardGreenApi(options) {
  const method = options.method.toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    return Promise.reject(Object.assign(new Error('method_not_allowed'), { statusCode: 405 }));
  }
  if (!HOST_RE.test(options.host)) {
    return Promise.reject(Object.assign(new Error('bad_proxy_target'), { statusCode: 400 }));
  }

  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      return;
    }

    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(value);
    };

    const headers = {
      host: options.host,
      accept: 'application/json',
    };
    const body = options.body ?? Buffer.alloc(0);
    if (body.length > 0) {
      headers['content-type'] = options.contentType || 'application/json';
      headers['content-length'] = String(body.length);
    }

    const req = https.request(
      {
        agent,
        protocol: 'https:',
        hostname: options.host,
        port: 443,
        method,
        path: options.path,
        headers,
        timeout: UPSTREAM_TIMEOUT_MS,
      },
      (upstream) => {
        const chunks = [];
        let received = 0;
        upstream.on('data', (chunk) => {
          received += chunk.length;
          if (received > MAX_RESPONSE) {
            upstream.destroy();
            req.destroy();
            finish(Object.assign(new Error('response_too_large'), { statusCode: 502 }));
            return;
          }
          chunks.push(chunk);
        });
        upstream.on('end', () => {
          const rawType = upstream.headers['content-type'];
          const contentType = Array.isArray(rawType) ? rawType[0] ?? null : rawType ?? null;
          finish(null, {
            status: upstream.statusCode || 502,
            contentType,
            body: Buffer.concat(chunks),
          });
        });
        upstream.on('error', (err) => finish(err));
      },
    );

    const fail = (err) => {
      req.destroy();
      finish(err);
    };

    req.on('timeout', () => {
      fail(Object.assign(new Error('timeout'), { name: 'TimeoutError', statusCode: 504 }));
    });
    req.on('error', (err) => finish(err));

    if (options.signal) {
      options.signal.addEventListener(
        'abort',
        () => fail(Object.assign(new Error('aborted'), { name: 'AbortError' })),
        { once: true },
      );
    }

    if (body.length > 0) req.write(body);
    req.end();
  });
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<Buffer>}
 */
async function readBody(req) {
  if (req.body != null && req.body !== '') {
    if (Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string') return Buffer.from(req.body);
    if (typeof req.body === 'object') return Buffer.from(JSON.stringify(req.body));
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > MAX_BODY) {
      throw Object.assign(new Error('body_too_large'), { statusCode: 413 });
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function header(headers, name) {
  if (!headers) return null;
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function sendJson(res, status, payload) {
  if (res.writableEnded) return;
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

/**
 * Connect/Node handler used by the Vite dev server and the Vercel function.
 * Never logs the request URL: it contains apiTokenInstance.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export async function handleNodeRequest(req, res) {
  const target = targetFromNodeRequest(req);
  if (!target) {
    sendJson(res, 400, { error: 'bad_proxy_target' });
    return;
  }

  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('cache-control', 'no-store');
    res.end();
    return;
  }
  if (!ALLOWED_METHODS.has(method)) {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  let body = Buffer.alloc(0);
  try {
    body = await readBody(req);
  } catch (err) {
    const status = err && err.statusCode === 413 ? 413 : 400;
    sendJson(res, status, { error: status === 413 ? 'body_too_large' : 'bad_request' });
    return;
  }

  const ac = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) ac.abort();
  };
  res.on('close', onClose);

  try {
    const result = await forwardGreenApi({
      method,
      host: target.host,
      path: target.path,
      body,
      contentType: header(req.headers, 'content-type'),
      signal: ac.signal,
    });
    if (res.writableEnded) return;
    res.statusCode = result.status;
    res.setHeader('content-type', result.contentType || 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(result.body);
  } catch (err) {
    if (res.writableEnded || ac.signal.aborted) return;
    const status = err && err.statusCode ? err.statusCode : 502;
    sendJson(res, status, { error: status === 405 ? 'method_not_allowed' : 'proxy_error' });
  } finally {
    res.off?.('close', onClose);
  }
}

/**
 * @param {import('@netlify/functions').HandlerEvent | {
 *   path?: string,
 *   rawUrl?: string,
 *   rawQuery?: string,
 *   httpMethod?: string,
 *   headers?: Record<string, string | undefined>,
 *   body?: string | null,
 *   isBase64Encoded?: boolean,
 * }} event
 */
export function targetFromNetlifyEvent(event) {
  const candidates = [];
  if (event.rawUrl) {
    try {
      const url = new URL(event.rawUrl);
      candidates.push(url.pathname + url.search);
    } catch {
      candidates.push(event.rawUrl);
    }
  }
  if (event.path) {
    const qs = event.rawQuery ? `?${event.rawQuery}` : '';
    candidates.push(`${event.path}${qs}`);
  }
  for (const candidate of candidates) {
    const parsed = parseProxyUrl(candidate);
    if (parsed) return parsed;
  }
  return null;
}

/**
 * @param {Parameters<typeof targetFromNetlifyEvent>[0]} event
 */
export async function handleNetlifyEvent(event) {
  const target = targetFromNetlifyEvent(event);
  if (!target) {
    return jsonResult(400, { error: 'bad_proxy_target' });
  }
  const method = String(event.httpMethod || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: { 'cache-control': 'no-store' }, body: '' };
  }
  if (!ALLOWED_METHODS.has(method)) {
    return jsonResult(405, { error: 'method_not_allowed' });
  }

  const body = event.body
    ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8')
    : Buffer.alloc(0);
  if (body.length > MAX_BODY) {
    return jsonResult(413, { error: 'body_too_large' });
  }

  try {
    const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || null;
    const result = await forwardGreenApi({
      method,
      host: target.host,
      path: target.path,
      body,
      contentType,
    });
    return {
      statusCode: result.status,
      headers: {
        'content-type': result.contentType || 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
      body: result.body.toString('utf8'),
    };
  } catch {
    return jsonResult(502, { error: 'proxy_error' });
  }
}

function jsonResult(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(payload),
  };
}
