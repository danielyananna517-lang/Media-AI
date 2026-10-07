import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  productionCapabilities,
  rnp,
  operatorRun,
  approveAction,
  executeApprovedAction,
  buildEpub,
  buildPdf
} from '../src/novessaProduction.mjs';

test('production integration patched the generated runtime',()=>{
  const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
  assert.match(server,/__novessaProduction/);
  assert.match(server,/\/api\/production\/operator/);
  assert.match(server,/\/api\/production\/book\/export/);
  assert.equal(existsSync(new URL('../public/index.html',import.meta.url)),true);
});

test('production capabilities declare real features and safe action boundary',()=>{
  const caps=productionCapabilities();
  assert.equal(caps.status,'verified');
  assert.equal(caps.book.epub,true);
  assert.equal(caps.book.pdf,true);
  assert.equal(caps.operator.approval,true);
  assert.equal(caps.operator.external_write_actions,false);
});

test('RNP is deterministic and auditable',()=>{
  const result=rnp({stock:20,sales_history:90,period_days:30,lead_time_days:7,safety_stock_days:2,target_cover_days:14});
  assert.equal(result.status,'verified');
  assert.equal(result.metrics.average_daily_sales,3);
  assert.equal(result.metrics.reorder_point,27);
  assert.equal(result.metrics.recommended_order,22);
  assert.equal(result.metrics.risk,'critical');
  assert.equal(result.provenance,'NOVESSA Core deterministic RNP');
});

test('RNP refuses incomplete input instead of guessing',()=>{
  const result=rnp({stock:20,sales_history:90,period_days:30});
  assert.equal(result.status,'input_incomplete');
});

test('operator creates real deterministic actions without inventing AI data',async()=>{
  const result=await operatorRun({
    objective:'գնահատել ապրանքի շահույթի և պաշարի ռիսկը',
    economics:{price:100,unit_cost:40,sales:10,commission_percent:10,logistics_per_unit:3,storage_per_unit:1,tax_percent:5,ad_spend:50},
    rnp:{stock:20,sales_history:90,period_days:30,lead_time_days:7,safety_stock_days:2,target_cover_days:14}
  });
  assert.equal(result.status,'verified');
  assert.equal(Array.isArray(result.actions),true);
  assert.ok(result.actions.some(a=>a.type==='reorder_plan'));
  assert.equal(result.interpretation.status,'provider_unavailable');
});

test('approval token is rejected when operator secret is absent',()=>{
  const result=approveAction('invalid');
  assert.equal(result.status,'invalid_data');
});

test('EPUB is a real ZIP package with uncompressed mimetype',()=>{
  const result=buildEpub({title:'Test Book',author:'A',language:'en',chapters:[{title:'One',text:'Hello world.'}]});
  assert.equal(result.status,'verified');
  assert.equal(result.media_type,'application/epub+zip');
  assert.equal(result.content.subarray(0,2).toString('binary'),'PK');
  assert.match(result.content.toString('binary'),'application/epub+zip');
});

test('PDF is a real PDF binary',()=>{
  const result=buildPdf({title:'Test Book',author:'A',chapters:[{title:'One',text:'Hello world.'}]});
  assert.equal(result.status,'verified');
  assert.equal(result.media_type,'application/pdf');
  assert.equal(result.content.subarray(0,8).toString('binary'),'%PDF-1.4');
});

test('approved internal action executes only after approval',()=>{
  const previous=process.env.NOVESSA_OPERATOR_ACTION_SECRET;
  process.env.NOVESSA_OPERATOR_ACTION_SECRET='test-operator-secret';
  const operatorPromise=operatorRun({
    rnp:{stock:1,sales_history:30,period_days:30,lead_time_days:7,safety_stock_days:1,target_cover_days:10}
  });
  return operatorPromise.then(async result=>{
    const action=result.actions.find(a=>a.type==='reorder_plan');
    assert.ok(action);
    const notApproved=await executeApprovedAction(action.approval_token);
    assert.equal(notApproved.status,'invalid_data');
    const approved=approveAction(action.approval_token);
    assert.equal(approved.status,'verified');
    const executed=await executeApprovedAction(approved.approval_token);
    assert.equal(executed.status,'verified');
    assert.equal(executed.executed,true);
    if(previous===undefined) delete process.env.NOVESSA_OPERATOR_ACTION_SECRET;
    else process.env.NOVESSA_OPERATOR_ACTION_SECRET=previous;
  });
});
