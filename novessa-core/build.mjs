  assert.equal(pricingWithoutToken.status,200);
  const protectedBody=JSON.stringify({entities:[],expected_totals:null});
  const protectedWithoutToken=await request(port,{method:'POST',path:'/ui/api/action/commerce-intelligence',body:protectedBody,headers:{'content-type':'application/json'}});
  assert.equal(protectedWithoutToken.status,401);
  const pricingWithToken=await request(port,{method:'POST',path:'/ui/api/action/pricing',body:pricingBody,headers:{'content-type':'application/json','x-ui-token':'ui-test-token'}});
  assert.equal(pricingWithToken.status,200);
});`
);
writeFileSync(uiTestPath, uiTest);

const coreTestPath = 'test/core.test.mjs';
let coreTest = readFileSync(coreTestPath, 'utf8');
coreTest = coreTest.replace(
  /(test\('HMAC signature is deterministic'[\s\S]*?assert\.equal\(signature\.length,\s*)43(\s*\);)/,
  '$1' + '64' + '$2'
);
writeFileSync(coreTestPath, coreTest);

const appPath = 'public/app.js';
let app = readFileSync(appPath, 'utf8');
app = app.replace(