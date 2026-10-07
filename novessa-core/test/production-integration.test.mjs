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
  buildPdf,
  buildXlsx
} from '../src/novessaProduction.mjs';
import { persistenceStatus, loadWorkspace, saveWorkspace } from '../src/persistence.mjs';

test('production integration patched the generated runtime',()=>{
  const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
  assert.match(server,/__novessaProduction/);
  assert.match(server,/\/api\/production\/operator/);
  assert.match(server,/\/api\/production\/book\/export/);
  assert.match(server,/\/ui\/api\/action\/workspace-save/);
  const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(index,/data-novessa-command-center/);
  assert.match(index,/NOVESSA • COMMAND CENTER/);
  assert.equal(existsSync(new URL('../public/index.html',import.meta.url)),true);
});

test('production capabilities declare real features and safe action boundary',()=>{
  const caps=productionCapabilities();
  assert.equal(caps.status,'verified');
  assert.equal(caps.book.epub,true);
  assert.equal(caps.book.pdf,true);
  assert.equal(caps.operator.approval,true);
  assert.equal(caps.operator.external_write_actions,true);
  assert.equal(caps.persistence.provider,'supabase-rest');
  assert.equal(caps.persistence.server_side,true);
});

test('persistence is explicit when the server database is not configured',()=>{
  const previousUrl=process.env.NOVESSA_PERSISTENCE_SUPABASE_URL;
  const previousKey=process.env.NOVESSA_PERSISTENCE_SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NOVESSA_PERSISTENCE_SUPABASE_URL;
  delete process.env.NOVESSA_PERSISTENCE_SUPABASE_SERVICE_ROLE_KEY;
  const status=persistenceStatus();
  assert.equal(status.status,'not_configured');
  assert.equal(status.multi_user_auth,false);
  if(previousUrl===undefined)delete process.env.NOVESSA_PERSISTENCE_SUPABASE_URL;else process.env.NOVESSA_PERSISTENCE_SUPABASE_URL=previousUrl;
  if(previousKey===undefined)delete process.env.NOVESSA_PERSISTENCE_SUPABASE_SERVICE_ROLE_KEY;else process.env.NOVESSA_PERSISTENCE_SUPABASE_SERVICE_ROLE_KEY=previousKey;
});

test('persistence REST adapter loads and saves with server-only auth',async()=>{
  const previousUrl=process.env.NOVESSA_PERSISTENCE_SUPABASE_URL;
  const previousKey=process.env.NOVESSA_PERSISTENCE_SUPABASE_SERVICE_ROLE_KEY;
  process.env.NOVESSA_PERSISTENCE_SUPABASE_URL='https://example.supabase.co';
  process.env.NOVESSA_PERSISTENCE_SUPABASE_SERVICE_ROLE_KEY='server-only-test-key';
  const calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,options});
    if(options.method==='GET')return new Response(JSON.stringify([{workspace_id:'owner',kind:'book',state:{title:'Persisted'},version:4,updated_at:'2026-10-07T00:00:00.000Z'}]),{status:200,headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify([{workspace_id:'owner',kind:'book',version:5,updated_at:'2026-10-07T00:00:01.000Z'}]),{status:201,headers:{'content-type':'application/json'}});
  };
  const loaded=await loadWorkspace({kind:'book'},{fetchImpl});
  assert.equal(loaded.status,'verified');
  assert.equal(loaded.state.title,'Persisted');
  const saved=await saveWorkspace({kind:'book',state:{title:'New'}},{fetchImpl});
  assert.equal(saved.status,'verified');
  assert.equal(saved.version,5);
  assert.match(calls[0].url,/novessa_workspaces\?workspace_id=eq.owner&kind=eq.book/);
  assert.equal(calls[1].options.headers.authorization,'Bearer server-only-test-key');
  assert.equal(calls[1].options.body.includes('server-only-test-key'),false);
  if(previousUrl===undefined)delete process.env.NOVESSA_PERSISTENCE_SUPABASE_URL;else process.env.NOVESSA_PERSISTENCE_SUPABASE_URL=previousUrl;
  if(previousKey===undefined)delete process.env.NOVESSA_PERSISTENCE_SUPABASE_SERVICE_ROLE_KEY;else process.env.NOVESSA_PERSISTENCE_SUPABASE_SERVICE_ROLE_KEY=previousKey;
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
  assert.ok(result.content.toString('binary').includes('application/epub+zip'));
});

test('XLSX export is a real ZIP workbook package',()=>{
  const result=buildXlsx({headers:['Ապրանք','Գին'],rows:[['Jeans',25.5]]});
  assert.equal(result.status,'verified');
  assert.equal(result.media_type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(result.content.subarray(0,2).toString('binary'),'PK');
  const zip=result.content.toString('binary');
  assert.ok(zip.includes('[Content_Types].xml'));
  assert.ok(zip.includes('xl/workbook.xml'));
  assert.ok(zip.includes('xl/worksheets/sheet1.xml'));
  assert.equal(result.row_count,1);
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
