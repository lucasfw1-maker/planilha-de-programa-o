import {test} from 'node:test';
import assert from 'node:assert/strict';
import {volumeValue} from '../volume.mjs';
test('volumes accept integers and exact half cubic metres without rounding',()=>{for(const n of [0,.5,1,3,3.5,4.5,32.5,100000])assert.equal(volumeValue(n),n);assert.equal(volumeValue('3.5'),3.5);});
test('rejects tenths and near-half values with a clear message',()=>{for(const n of [3.2,3.4,32.4,.1,.49,.500000001,32.500000001])assert.throws(()=>volumeValue(n),e=>e.status===400&&/0,5/.test(e.message));});
test('preserves bounds and rejects invalid values and coerced booleans/arrays',()=>{for(const v of [-1,Infinity,NaN,'',null,undefined,true,[],{},'abc',100000.5])assert.throws(()=>volumeValue(v));assert.throws(()=>volumeValue(0,'Volume',.5));assert.equal(volumeValue(.5,'Volume',.5),.5);assert.equal(volumeValue(100000000,'Meta',.5,100000000),100000000);});
