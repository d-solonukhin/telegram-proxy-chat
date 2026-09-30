import assert from 'node:assert/strict';
import test from 'node:test';
import { parseProxyUrl } from './greenProxy.mjs';

test('parses the dev proxy path and keeps the query string', () => {
  const parsed = parseProxyUrl(
    '/green-api/4100.api.green-api.com/waInstance4100000000/receiveNotification/secret-token?receiveTimeout=20',
  );
  assert.deepEqual(parsed, {
    host: '4100.api.green-api.com',
    path: '/waInstance4100000000/receiveNotification/secret-token?receiveTimeout=20',
  });
});

test('parses Vercel and Netlify prefixes', () => {
  assert.equal(
    parseProxyUrl('/api/green-api/1101.api.green-api.com/waInstance1/getStateInstance/tok')?.host,
    '1101.api.green-api.com',
  );
  assert.equal(
    parseProxyUrl('/.netlify/functions/green-api/api.green-api.com/waInstance1/sendMessage/tok')?.path,
    '/waInstance1/sendMessage/tok',
  );
});

test('rejects hosts outside green-api.com', () => {
  assert.equal(parseProxyUrl('/green-api/example.com/waInstance1/getStateInstance/tok'), null);
  assert.equal(
    parseProxyUrl('/green-api/4100.api.green-api.com.evil.com/waInstance1/getStateInstance/tok'),
    null,
  );
  assert.equal(parseProxyUrl('/green-api/evil.green-api.com.attacker.com/x'), null);
  assert.equal(parseProxyUrl('/not-proxy/4100.api.green-api.com/x'), null);
});

test('rejects empty and broken hosts', () => {
  assert.equal(parseProxyUrl('/green-api/'), null);
  assert.equal(parseProxyUrl('/green-api/../waInstance'), null);
  assert.equal(parseProxyUrl(''), null);
});
