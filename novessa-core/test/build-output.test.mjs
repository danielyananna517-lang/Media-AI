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
  assert.match(server,//ui/api/action//);
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
