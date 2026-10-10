import test from 'node:test';
import assert from 'node:assert/strict';
import { RPC2Client } from '../src/lib/rpc2.ts';

function hangingFetch(_url, {signal}) {
  return new Promise((_resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    signal?.addEventListener('abort', () => reject(signal.reason), {once:true});
  });
}
test('HTTP requests combine caller cancellation with a timeout', async (t) => {
  t.mock.method(globalThis, 'fetch', hangingFetch);
  const client = new RPC2Client('/api/rpc2', {autoConnect:false});
  const controller = new AbortController();
  const request = client.callViaHTTP('common:getRecords', {}, {signal:controller.signal, timeout:50});
  controller.abort(new Error('collapsed'));
  await assert.rejects(request, /collapsed/);
});
test('HTTP request times out even when caller signal stays active', async (t) => {
  t.mock.method(globalThis, 'fetch', hangingFetch);
  const timer = setTimeout(() => {}, 100);
  try {
    const client = new RPC2Client('/api/rpc2', {autoConnect:false});
    await assert.rejects(client.callViaHTTP('common:getRecords', {}, {signal:new AbortController().signal, timeout:10}), {name:'TimeoutError'});
  } finally { clearTimeout(timer); }
});
