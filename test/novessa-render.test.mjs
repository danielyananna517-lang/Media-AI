import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const htmlMatch = source.match(/res\.send\(\x60([\s\S]*?)\x60\);\s*\}\);/);
assert.ok(htmlMatch, 'server.js should contain the current inline NOVESSA page');
const html = htmlMatch[1];
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(scriptMatch, 'NOVESSA page should include an inline application script');
const uiScript = scriptMatch[1];

function createNode(id, value = '') {
  return {
    id, value, style: {}, textContent: '', innerText: '', innerHTML: '',
    children: [], replaceChildren(...items) { this.children = items; },
    append(...items) { this.children.push(...items); },
    appendChild(item) { this.children.push(item); },
    remove() {}, setAttribute() {}
  };
}

function buildUI(values = {}, fetchImpl = async () => ({
  ok: false, status: 503, json: async () => ({ error: 'AI_NOT_CONFIGURED' })
})) {
  const nodes = new Map();
  for (const [id, value] of Object.entries(values)) nodes.set(id, createNode(id, value));
  const document = {
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, createNode(id));
      return nodes.get(id);
    },
    createElement(tag) { return createNode(tag); },
    body: { appendChild(node) { (this.children ||= []).push(node); } },
    fonts: { ready: Promise.resolve() }
  };
  const alerts = [];
  const localData = new Map();
  const localStorage = {
    getItem(key) { return localData.has(key) ? localData.get(key) : null; },
    setItem(key, value) { localData.set(key, String(value)); }
  };
  const window = { XLSX: null, jspdf: null, html2canvas: null };
  const app = new Function(
    'document', 'window', 'fetch', 'alert', 'localStorage',
    uiScript + '\nreturn { calculateMaster, calculateStockPredictor, generateSEOText, askAI, saveCalculation, loadHistory, getCurrentCalc: () => currentCalc };'
  )(document, window, fetchImpl, message => alerts.push(String(message)), localStorage);
  return { app, nodes, alerts, localData };
}

function buildServer(env = {}, providerFetch = async () => ({
  ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'TEST AI RESPONSE' }] } }] })
})) {
  const handlers = new Map();
  const app = {
    handlers,
    use() {},
    get(route, fn) { handlers.set('GET ' + route, fn); },
    post(route, fn) { handlers.set('POST ' + route, fn); },
    listen(_port, callback) { callback?.(); }
  };
  function fakeExpress() { return app; }
  fakeExpress.json = () => () => {};
  const script = source.replace(/^import express from 'express';\s*/m, '');
  new vm.Script(script, { filename: 'server.js' });
  new Function('express', 'process', 'fetch', 'console', script + '\nreturn app;')(
    fakeExpress,
    { env: { PORT: '3000', ...env } },
    providerFetch,
    { log() {}, error() {} }
  );
  return handlers;
}

async function callRoute(handlers, method, route, body = {}) {
  const fn = handlers.get(method + ' ' + route);
  assert.ok(fn, 'Expected route ' + method + ' ' + route);
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    send(payload) { this.body = payload; return this; }
  };
  await fn({ body: body || {}, headers: {} }, res);
  return res;
}

test('backend and embedded frontend JavaScript parse', () => {
  new vm.Script(source.replace(/^import express from 'express';\s*/m, ''), { filename: 'server.js' });
  new vm.Script(uiScript, { filename: 'novessa-frontend.js' });
});

test('unit economics returns the known result and preserves 0% commission', () => {
  const { app, nodes } = buildUI({
    productTitle: 'TEST ONLY', platform: 'Wildberries', price: '100', cost: '40',
    commission: '10', logistics: '3', revLogistics: '1', storagePerDay: '0.1',
    avgDays: '10', buyoutRate: '80', adCost: '5', tax: '5'
  });
  app.calculateMaster();
  let result = app.getCurrentCalc();
  assert.equal(result.netProfit, 35.8);
  assert.equal(result.margin, '35.8');
  assert.equal(result.roi, '89.5');

  nodes.get('commission').value = '0';
  app.calculateMaster();
  result = app.getCurrentCalc();
  assert.equal(result.commission, 0);
  assert.equal(result.netProfit, 45.8);
});

test('Stock-Out Predictor includes the reorder point in its calculation', () => {
  const { app, nodes } = buildUI({
    stockSku: 'SKU-TEST', currentStock: '500', dailySales: '15',
    leadTime: '14', safetyStock: '50'
  });
  app.calculateStockPredictor();
  const result = nodes.get('stockResult').textContent;
  assert.match(result, /Վերապատվիրման շեմ՝ 260 հատ/);
  assert.match(result, /Առաջարկվող պատվերի քանակ՝ 210 հատ/);
  assert.match(result, /33\.3/);
});

test('SEO does not return fake content when the AI provider is unavailable', async () => {
  const { app, nodes } = buildUI({ seoInput: 'կանացի ջինսեր' });
  await app.generateSEOText();
  assert.equal(nodes.get('seoResult').textContent, 'AI_NOT_CONFIGURED');
});

test('history is explicitly browser-local and renders saved strings as text', () => {
  const { app, nodes, localData } = buildUI({
    productTitle: '<img src=x onerror=alert(1)>', platform: 'Wildberries',
    price: '100', cost: '40', commission: '10', logistics: '3',
    revLogistics: '1', storagePerDay: '0.1', avgDays: '10',
    buyoutRate: '80', adCost: '5', tax: '5'
  });
  app.calculateMaster();
  app.saveCalculation();
  const saved = JSON.parse(localData.get('novessaHistory'));
  assert.equal(saved.length, 1);
  app.loadHistory();
  const titleNode = nodes.get('historyList').children[0].children[0];
  assert.match(titleNode.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(titleNode.innerHTML, '');
});

test('AI API refuses to fake responses when no server key is configured', async () => {
  const handlers = buildServer({});
  const response = await callRoute(handlers, 'POST', '/api/ai', { prompt: 'hello' });
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'AI_NOT_CONFIGURED');
  assert.equal('reply' in response.body, false);
});

test('AI API uses server-side configuration and reports provider replies', async () => {
  let requestedUrl = '';
  let requestedHeaders = {};
  const handlers = buildServer({ GEMINI_API_KEY: 'test-secret', GEMINI_MODEL: 'gemini-3.8-flash' }, async (url, options) => {
    requestedUrl = String(url);
    requestedHeaders = options.headers;
    return {
      ok: true, status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'TEST AI RESPONSE' }] } }] })
    };
  });
  const response = await callRoute(handlers, 'POST', '/api/ai', { prompt: 'hello' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.reply, 'TEST AI RESPONSE');
  assert.match(requestedUrl, /gemini-3\.8-flash:generateContent/);
  assert.equal(requestedHeaders['x-goog-api-key'], 'test-secret');
  assert.equal(requestedUrl.includes('test-secret'), false);
});

test('Gemini UI key field is restored and sent transiently to the server endpoint', async () => {
  assert.match(html, /id="geminiKey"/);
  assert.match(uiScript, /apiKey: currentGeminiKey\(\)/);
  assert.match(uiScript, /function currentGeminiKey\(\)/);

  let requestedUrl = '';
  let requestedHeaders = {};
  const handlers = buildServer({}, async (url, options) => {
    requestedUrl = String(url);
    requestedHeaders = options.headers;
    return {
      ok: true, status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'USER KEY RESPONSE' }] } }] })
    };
  });
  const userProvidedKey = 'user-provided-test-key';
  const response = await callRoute(handlers, 'POST', '/api/ai', { prompt: 'hello', apiKey: userProvidedKey });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.reply, 'USER KEY RESPONSE');
  assert.equal(requestedHeaders['x-goog-api-key'], userProvidedKey);
  assert.equal(requestedUrl.includes(userProvidedKey), false);
  assert.equal(source.includes(userProvidedKey), false);
});

test('background removal reports missing configuration rather than fake success', async () => {
  const handlers = buildServer({});
  const response = await callRoute(handlers, 'POST', '/api/remove-background', {
    imageData: 'data:image/png;base64,AAAA'
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'BACKGROUND_REMOVAL_NOT_CONFIGURED');
  assert.equal(response.body.success, false);
});
