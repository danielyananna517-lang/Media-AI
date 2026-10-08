import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port=8787;
const base=`http://127.0.0.1:${port}`;

async function waitForHealth(child){
  for(let i=0;i<20;i++){
    if(child.exitCode!==null) throw new Error('server exited before health check');
    try{
      const r=await fetch(base+'/health');
      if(r.ok) return;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('server did not become healthy');
}

async function call(payload){
  const r=await fetch(base+'/ui/api/action/reverse-profit',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(payload)
  });
  const text=await r.text();
  let body={};try{body=JSON.parse(text)}catch{}
  return {status:r.status,body};
}

async function withServer(fn){
  const child=spawn(process.execPath,['server.mjs'],{
    env:{...process.env,NOVESSA_ENV:'production',NOVESSA_UI_TOKEN:'test-ui-token'}
  });
  try{await waitForHealth(child);return await fn();}finally{child.kill('SIGTERM');}
}

test('reverse-profit UI action calculates target unit profit price',async()=>{
  await withServer(async()=>{
    const r=await call({target_type:'unit_profit',target_value:50,unit_cost:50,sales:28,commission_percent:10,logistics_per_unit:10,storage_per_unit:2,tax_percent:0,ad_spend:28});
    assert.equal(r.status,200);
    assert.equal(r.body.status,'verified');
    assert.ok(Math.abs(r.body.required_price-125.555556)<0.00001);
    assert.ok(Math.abs(r.body.projected_unit_profit-50)<0.00001);
  });
});

test('reverse-profit UI action calculates target margin price',async()=>{
  await withServer(async()=>{
    const r=await call({target_type:'margin',target_value:20,unit_cost:50,sales:28,commission_percent:10,logistics_per_unit:10,storage_per_unit:2,tax_percent:0,ad_spend:28});
    assert.equal(r.status,200);
    assert.equal(r.body.status,'verified');
    assert.ok(Math.abs(r.body.required_price-90)<0.00001);
    assert.ok(Math.abs(r.body.projected_margin_percent-20)<0.00001);
  });
});

test('reverse-profit UI action calculates target total profit price',async()=>{
  await withServer(async()=>{
    const r=await call({target_type:'total_profit',target_value:504,unit_cost:50,sales:28,commission_percent:10,logistics_per_unit:10,storage_per_unit:2,tax_percent:0,ad_spend:28});
    assert.equal(r.status,200);
    assert.equal(r.body.status,'verified');
    assert.ok(Math.abs(r.body.required_price-125.555556)<0.00001);
  });
});

test('reverse-profit UI action rejects unreachable target mathematics',async()=>{
  await withServer(async()=>{
    const r=await call({target_type:'margin',target_value:20,unit_cost:10,sales:10,commission_percent:70,logistics_per_unit:1,storage_per_unit:1,tax_percent:15,ad_spend:10});
    assert.equal(r.status,400);
    assert.equal(r.body.status,'invalid_data');
  });
});
