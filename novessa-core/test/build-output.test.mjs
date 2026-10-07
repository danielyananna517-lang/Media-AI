import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Core build output contains user language settings',()=>{
  const html=fs.readFileSync('public/index.html','utf8');
  assert.match(html,/data-tab="settings"/);
  assert.match(html,/id="languageSelect"/);
  assert.match(html,/value="hy"/);
  assert.match(html,/value="ru"/);
  assert.match(html,/value="en"/);
});

test('Core build output keeps access code inside Settings',()=>{
  const html=fs.readFileSync('public/index.html','utf8');
  const settings=html.slice(html.indexOf('id="tab-settings"'));
  const beforeSettings=html.slice(0,html.indexOf('id="tab-settings"'));
  assert.match(settings,/id="uiToken"/);
  assert.doesNotMatch(beforeSettings,/id="uiToken"/);
});

test('Core build output uses the production-safe UI action route',()=>{
  const server=fs.readFileSync('server.mjs','utf8');
  assert.match(server,/\/ui\/api\/action\//);
  assert.match(server,/verifyUiAccess/);
  assert.doesNotMatch(server,/publicUiActions/);
});

test('Core build output has premium dashboard styling and multilingual runtime',()=>{
  const css=fs.readFileSync('public/styles.css','utf8');
  const html=fs.readFileSync('public/index.html','utf8');
  assert.match(css,/--novessa-cobalt/);
  assert.match(css,/--novessa-purple/);
  assert.match(html,/novessa_ui_language/);
  assert.match(html,/Commerce Analytics Core/);
  assert.match(html,/Core бизнес-аналитики/);
});

test('Core Media client matches the verified Media AI HMAC contract',async()=>{
  const crypto = await import('node:crypto');
  const { requestMedia } = await import('../src/mediaClient.mjs');
  const secret='test-media-secret';
  const oldBase=process.env.NOVESSA_GATEWAY_BASE_URL;
  const oldSecret=process.env.NOVESSA_GATEWAY_SHARED_SECRET;
  const oldEnv=process.env.NOVESSA_ENV;
  process.env.NOVESSA_GATEWAY_BASE_URL='https://example.test';
  process.env.NOVESSA_GATEWAY_SHARED_SECRET=secret;
  process.env.NOVESSA_ENV='development';
  let call=null;
  const out=await requestMedia({
    operation:'chat',
    input:{message:'hello'},
    requestId:'req-test-1',
    nowMs:1700000000000,
    fetchImpl:async(url,options)=>{
      call={url,options};
      const body=String(options.body);
      const expected=crypto.createHmac('sha256',secret)
        .update('1700000000000:req-test-1:'+body)
        .digest('hex');
      assert.equal(options.headers['X-Media-Signature'],expected);
      assert.equal(options.headers['X-Media-Timestamp'],'1700000000000');
      assert.equal(options.headers['X-Media-Service-Id'],'novessa-core');
      assert.equal(options.headers['X-Media-Request-Id'],'req-test-1');
      assert.equal(body,JSON.stringify({operation:'chat',input:{message:'hello'}}));
      return new Response(JSON.stringify({
        request_id:'req-test-1',
        status:'success',
        operation:'chat',
        version:'6.1.0-rebuilt'
      }),{status:200,headers:{'content-type':'application/json'}});
    }
  });
  assert.equal(call.url,'https://example.test/v1/media/request');
  assert.equal(out.status,'success');
  assert.equal(out.request_id,'req-test-1');
  if(oldBase===undefined) delete process.env.NOVESSA_GATEWAY_BASE_URL; else process.env.NOVESSA_GATEWAY_BASE_URL=oldBase;
  if(oldSecret===undefined) delete process.env.NOVESSA_GATEWAY_SHARED_SECRET; else process.env.NOVESSA_GATEWAY_SHARED_SECRET=oldSecret;
  if(oldEnv===undefined) delete process.env.NOVESSA_ENV; else process.env.NOVESSA_ENV=oldEnv;
});