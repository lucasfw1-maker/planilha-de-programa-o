import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectionDays} from '../production.mjs';

test('projeção conta a referência inclusive e distingue dias de operação',()=>{
 assert.equal(projectionDays('2026-10','2026-10-26','all').filter(d=>d.remaining).length,6);
 assert.equal(projectionDays('2026-10','2026-10-26','mon_sat').filter(d=>d.remaining).length,6);
 assert.equal(projectionDays('2026-10','2026-10-26','mon_fri').filter(d=>d.remaining).length,5);
 assert.equal(projectionDays('2026-10','2026-10-31','mon_fri').filter(d=>d.remaining).length,0);
 assert.equal(projectionDays('2026-10','2026-11-01','all').filter(d=>d.remaining).length,0);
 assert.equal(projectionDays('2028-02','2028-01-01','all').length,29);
 assert.throws(()=>projectionDays('2026-10','2026-10-01','inválido'),/dias de operação/);
});
