import cbEstimate from '../public/cb-estimate.js';
import {test} from 'node:test';import assert from 'node:assert/strict';import {estimatedCBs} from '../cb-utilization.mjs';
test('estimativa de CBs aplica faixas e limites exatos, incluindo 80 a 100 m³',()=>{for(const [volume,expected]of[[0,0],[1,1],[20,1],[20.1,2],[30,2],[30.1,3],[50,3],[50.1,4],[80,4],[80.1,5],[100,5],[100.1,5],[1000,5]])assert.equal(estimatedCBs(volume),expected,String(volume));});

test('ajuste manual tem prioridade e vazio mantém estimativa pelo volume',()=>{assert.equal(cbEstimate.requiredCBs({planned_volume:120,cb_demand_override:null}),5);assert.equal(cbEstimate.requiredCBs({planned_volume:120,cb_demand_override:2}),2);assert.equal(cbEstimate.requiredCBs({planned_volume:120,cb_demand_override:0}),0);});
