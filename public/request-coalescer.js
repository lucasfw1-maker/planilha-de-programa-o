/* Share only identical GETs currently in flight. Never retain responses or share mutations. */
(function(root){
 function createRequestCoalescer(){const pending=new Map();return {clear(){pending.clear();},run(key,request){if(pending.has(key))return pending.get(key).then(value=>structuredClone(value));const promise=Promise.resolve().then(request);pending.set(key,promise);const clean=()=>{if(pending.get(key)===promise)pending.delete(key);};promise.then(clean,clean);return promise;}};}
 if(typeof module==='object'&&module.exports)module.exports=createRequestCoalescer;else root.createRequestCoalescer=createRequestCoalescer;
})(globalThis);
