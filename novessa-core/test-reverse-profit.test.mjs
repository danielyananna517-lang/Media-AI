import test from 'node:test';
import assert from 'node:assert/strict';
import { reverseProfit } from './production.mjs';

test('reverseProfit calculates the price needed for target unit profit',()=>{
  const r=reverseProfit({
    target_type:'unit_profit',
    target_value:50,
    unit_cost:50,
    sales:28,
    commission_percent:10,
    logistics_per_unit:10,
    storage_per_unit:2,
    tax_percent:0,
    ad_spend:28
  });
  assert.equal(r.status,'verified');
  assert.ok(Math.abs(r.required_price-125.555556)<0.00001);
  assert.ok(Math.abs(r.projected_unit_profit-50)<0.00001);
});

test('reverseProfit calculates the price needed for target margin',()=>{
  const r=reverseProfit({
    target_type:'margin',
    target_value:20,
    unit_cost:50,
    sales:28,
    commission_percent:10,
    logistics_per_unit:10,
    storage_per_unit:2,
    tax_percent:0,
    ad_spend:28
  });
  assert.equal(r.status,'verified');
  assert.ok(Math.abs(r.required_price-90)<0.00001);
  assert.ok(Math.abs(r.projected_margin_percent-20)<0.00001);
});

test('reverseProfit calculates the price for a target total profit',()=>{
  const r=reverseProfit({
    target_type:'total_profit',
    target_value:504,
    unit_cost:50,
    sales:28,
    commission_percent:10,
    logistics_per_unit:10,
    storage_per_unit:2,
    tax_percent:0,
    ad_spend:28
  });
  assert.equal(r.status,'verified');
  assert.ok(Math.abs(r.required_price-125.555556)<0.00001);
});

test('reverseProfit rejects unreachable target mathematics',()=>{
  const r=reverseProfit({
    target_type:'margin',
    target_value:20,
    unit_cost:10,
    sales:10,
    commission_percent:70,
    logistics_per_unit:1,
    storage_per_unit:1,
    tax_percent:15,
    ad_spend:10
  });
  assert.equal(r.status,'invalid_data');
});
