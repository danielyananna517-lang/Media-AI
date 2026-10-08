import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { pricingDecision } from './src/novessaProduction.mjs';

const port=8787;
const base=`http://127.0.0.1:${port}`;

async function waitForHealth(child){
  for(let i=0;i<30;i++){
    if(child.exitCode!==null) throw new Error('server exited before health check');
    try{const r=await fetch(base+'/health');if(r.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('server did not become healthy');
}

async function withServer(fn){
  const child=spawn(process.execPath,['server.mjs'],{
    env:{...process.env,NOVESSA_ENV:'production',NOVESSA_UI_TOKEN:'test-ui-token'}
  });
  try{await waitForHealth(child);return await fn();}finally{child.kill('SIGTERM');}
}

const input={
  current_price:100,
  target_margin_percent:20,
  discount_percent:25,
  unit_cost:40,
  sales:10,
  commission_percent:10,
  logistics_per_unit:3,
  storage_per_unit:1,
  tax_percent:5,
  ad_spend:20
};

test('pricing decision is deterministic and exposes reference prices',()=>{
  const result=pricingDecision(input);
  assert.equal(result.status,'verified');
  assert.equal(result.decision.status,'profitable');
  assert.ok(Math.abs(result.decision.current_unit_profit-39)<1e-9);
  assert.ok(Math.abs(result.decision.current_margin_percent-39)<1e-9);
  assert.ok(Math.abs(result.price_references.break_even_price-54.11764705882353)<1e-9);
  assert.ok(Math.abs(result.price_references.target_margin_price-70.76923076923077)<1e-9);
  assert.deepEqual(result.price_references.price_range,{min:54.117647,max:70.769231,basis:'break-even to target-margin reference range; not a market-price claim'});
  assert.ok(Math.abs(result.discount.price-75)<1e-9);
  assert.ok(Math.abs(result.discount.unit_profit-17.75)<1e-9);
  assert.equal(result.provenance,'NOVESSA Core deterministic pricing decision');
});

test('pricing decision classifies a weak current price without inventing a market price',()=>{
  const result=pricingDecision({...input,current_price:68,discount_percent:0});
  assert.equal(result.status,'verified');
  assert.equal(result.decision.status,'weak');
  assert.equal(result.price_references.break_even_price,54.117647);
  assert.equal(result.price_references.target_margin_price,70.769231);
  assert.match(result.price_references.price_range.basis,/not a market-price claim/);
});

test('pricing decision classifies loss and flags a harmful discount',()=>{
  const result=pricingDecision({...input,current_price:50,discount_percent:20});
  assert.equal(result.status,'verified');
  assert.equal(result.decision.status,'loss');
  assert.equal(result.discount.unit_profit,-12);
  assert.match(result.decision.next_action,/գին|ծախս|break-even/i);
});

test('pricing decision rejects incomplete and unreachable targets',()=>{
  assert.equal(pricingDecision({...input,target_margin_percent:100}).status,'invalid_data');
  assert.equal(pricingDecision({...input,commission_percent:90,tax_percent:10,target_margin_percent:1}).status,'invalid_data');
  assert.equal(pricingDecision({...input,sales:0}).status,'input_incomplete');
});

test('pricing decision HTTP route uses the same deterministic module',async()=>{
  await withServer(async()=>{
    const r=await fetch(base+'/api/production/pricing-decision',{
      method:'POST',
      headers:{'content-type':'application/json','x-request-id':'pricing-decision-test-001'},
      body:JSON.stringify(input)
    });
    const body=await r.json();
    assert.equal(r.status,200,JSON.stringify(body));
    assert.equal(body.status,'verified');
    assert.equal(body.decision.status,'profitable');
    assert.equal(body.price_references.target_margin_price,70.769231);
  });
});

test('pricing decision safe UI action is exposed without claiming market data',async()=>{
  await withServer(async()=>{
    const r=await fetch(base+'/ui/api/action/pricing-decision',{
      method:'POST',
      headers:{'content-type':'application/json','x-request-id':'pricing-decision-test-002'},
      body:JSON.stringify(input)
    });
    const body=await r.json();
    assert.equal(r.status,200,JSON.stringify(body));
    assert.equal(body.status,'verified');
    assert.equal(body.price_references.price_range.basis,'break-even to target-margin reference range; not a market-price claim');
  });
});
