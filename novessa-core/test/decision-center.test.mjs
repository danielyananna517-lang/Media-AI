import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Decision Center is wired to real Core endpoints',()=>{
  const html=fs.readFileSync('public/index.html','utf8');
  assert.match(html,/data-novessa-decision-center/);
  assert.match(html,//ui/api/action/unit-economics/);
  assert.match(html,//api/ui/status/);
  assert.match(html,//api/connectors/status/);
  assert.match(html,//api/connectors/wildberries/status/);
  assert.match(html,/without invented financial numbers|առանց AI-ի կողմից ֆինանսական թիվ հորինելու|без выдуманных финансовых цифр/);
  assert.doesNotMatch(html,/\$\d+(?:\.\d+)?[KMB]?\s*(?:revenue|profit|sales)/i);
});