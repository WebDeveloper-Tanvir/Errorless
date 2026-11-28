/**
 * Source of the script injected FIRST into every preview document. It runs inside the sandboxed
 * iframe and reports console output and errors to the parent over postMessage.
 *
 * Trust model: the frame is `sandbox="allow-scripts"` without `allow-same-origin`, so it has an
 * opaque origin and cannot read the app's cookies, storage or DOM. The parent treats every message
 * as untrusted text: it checks `event.source` and the per-run nonce and never evaluates anything.
 */
export const BRIDGE_SOURCE = "errorless-preview"
export const MAX_ARG_CHARS = 4000

export function bridgeScript(nonce: string, parentOrigin: string): string {
  const n = JSON.stringify(nonce)
  const o = JSON.stringify(parentOrigin)
  return `(function(){
var N=${n},O=${o},S=${JSON.stringify(BRIDGE_SOURCE)},MAX=${MAX_ARG_CHARS};
function send(type,d){try{var m={source:S,nonce:N,type:type};for(var k in d)m[k]=d[k];parent.postMessage(m,O)}catch(e){}}
function ser(v,depth,seen){
  depth=depth||0;seen=seen||[];
  try{
    if(v===undefined)return"undefined";if(v===null)return"null";
    var t=typeof v;
    if(t==="string")return depth?JSON.stringify(v):v;
    if(t==="number"||t==="boolean"||t==="bigint")return String(v);
    if(t==="symbol")return v.toString();
    if(t==="function")return"[Function"+(v.name?": "+v.name:"")+"]";
    if(v instanceof Error)return String(v.stack||v.name+": "+v.message);
    if(typeof Node!=="undefined"&&v instanceof Node)return"<"+(v.nodeName||"node").toLowerCase()+">";
    if(seen.indexOf(v)>-1)return"[Circular]";
    if(depth>=3)return Array.isArray(v)?"[Array]":"[Object]";
    seen.push(v);
    if(Array.isArray(v))return"["+v.slice(0,100).map(function(x){return ser(x,depth+1,seen)}).join(", ")+(v.length>100?", …":"")+"]";
    var keys=Object.keys(v).slice(0,50);
    return"{"+keys.map(function(k){return k+": "+ser(v[k],depth+1,seen)}).join(", ")+"}";
  }catch(e){return"[Unserializable]"}
}
function clip(s){s=String(s);return s.length>MAX?s.slice(0,MAX)+"… (truncated)":s}
["log","info","warn","error","debug"].forEach(function(level){
  var orig=console[level];
  console[level]=function(){
    var args=[];for(var i=0;i<arguments.length;i++)args.push(clip(ser(arguments[i])));
    send("console",{level:level,text:args.join(" ")});
    if(orig)try{orig.apply(console,arguments)}catch(e){}
  };
});
window.addEventListener("error",function(e){
  send("error",{message:clip(e.message||"Script error"),line:e.lineno||0,col:e.colno||0,stack:e.error&&e.error.stack?clip(e.error.stack):""});
});
window.addEventListener("unhandledrejection",function(e){
  var r=e.reason;send("error",{message:clip("Unhandled promise rejection: "+ser(r)),line:0,col:0,stack:r&&r.stack?clip(r.stack):""});
});
window.addEventListener("load",function(){send("loaded",{});setTimeout(function(){send("done",{})},0)});
})();`
}
