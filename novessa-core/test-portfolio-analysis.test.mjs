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
      if(r.ok)return;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('server did not become healthy');
}

async function call(payload){
  const r=await fetch(base+'/ui/api/action/portfolio-analysis',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(payload)
  });
  const raw=await r.text();
  let body={};try{body=JSON.parse(raw)}catch{}
  return{status:r.status,body};
}

async function withServer(fn){
  const child=spawn(process.execPath,['server.mjs'],{
    env:{...process.env,NOVESSA_ENV:'production',NOVESSA_UI_TOKEN:'test-ui-token'}
  });
  try{await waitForHealth(child);return await fn();}finally{child.kill('SIGTERM');}
}

test('portfolio analysis ranks supplied products by total profit',async()=>{
  await withServer(async()=>{
    const r=await call({rows:[
      {name:'A',sku:'A1',price:100,cost:50,sales:20,commission_percent:10,logistics_per_unit:5,storage_per_unit:2,tax_percent:0,ad_spend:20},
      {name:'B',sku:'B1',price:80,cost:60,sales:10,commission_percent:10,logistics_per_unit:5,storage_per_unit:2,tax_percent:0,ad_spend:10}
    ]});
    assert.equal(r.status,200,JSON.stringify(r.body));
    assert.equal(r.body.status,'verified');
    assert.equal(r.body.summary.rows_verified,2);
    assert.equal(r.body.summary.loss_making_rows,0);
    assert.equal(r.body.summary.total_sales,30);
    assert.equal(r.body.summary.total_revenue,2800);
    console.log('PORTFOLIO_DEBUG',JSON.stringify(r.body));
    assert.equal(r.body.summary.total_profit,680);
    assert.equal(r.body.ranking[0].name,'A');
    assert.ok(r.body.ranking[0].total_profit>r.body.ranking[1].total_profit);
  });
});

test('portfolio analysis keeps incomplete rows explicit without inventing values',async()=>{
  await withServer(async()=>{
    const r=await call({rows:[
      {name:'A',price:100,cost:50,sales:20,commission_percent:10,logistics_per_unit:5,storage_per_unit:2,tax_percent:0,ad_spend:20},
      {name:'Incomplete',price:80,sales:10,commission_percent:10,logistics_per_unit:5,storage_per_unit:2,tax_percent:0,ad_spend:10}
    ]});
    assert.equal(r.status,200,JSON.stringify(r.body));
    assert.equal(r.body.status,'partial');
    assert.equal(r.body.summary.rows_verified,1);
    assert.equal(r.body.summary.rows_incomplete,1);
    const incomplete=r.body.rows.find(x=>x.product.name==='Incomplete');
    assert.equal(incomplete.status,'input_incomplete');
    assert.ok(incomplete.missing.includes('unit_cost'));
  });
});
