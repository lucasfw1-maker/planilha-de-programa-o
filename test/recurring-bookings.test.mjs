import {test} from 'node:test';
import assert from 'node:assert/strict';
import recurring from '../public/recurring-bookings.js';
test('semana lista sete dias corridos, sem domingo e com sábado opcional',()=>{assert.deepEqual(recurring.dates('2026-11-02','week'),['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06']);assert.equal(recurring.dates('2026-11-02','week',true).length,6);assert(!recurring.dates('2026-11-06','week',true).includes('2026-11-08'));});
test('mês vai da data escolhida até o fim do mês, inclusive em ano bissexto',()=>{const rows=recurring.dates('2026-11-02','month',true);assert.equal(rows.length,25);assert.equal(rows.at(-1),'2026-11-30');assert(recurring.dates('2028-02-01','month',true).includes('2028-02-29'));assert(!recurring.dates('2028-02-01','month',true).includes('2028-03-01'));});
test('recusa datas e períodos inválidos',()=>{for(const [d,p,s]of [['2026-02-30','week',false],['x','month',false],['2026-11-02','year',false],['2026-11-02','week','true']])assert.throws(()=>recurring.dates(d,p,s));});
