import { PYTHON_SOURCE } from "./python-protocol.ts"
import { PYTHON_WORKER_SOURCE } from "./python-worker-source.ts"

/**
 * HTML for the hidden, sandboxed iframe that hosts the Python worker.
 * The iframe is `sandbox="allow-scripts"` (opaque origin), so everything inside has an opaque
 * origin. Its CSP only allows loading the runtime from `baseUrl`'s origin: user Python cannot make
 * requests to other hosts, and cannot reach the app's cookies or storage.
 */
export function pythonFrameHtml(opts: { nonce: string; parentOrigin: string; baseUrl: string }): string {
  const runtimeOrigin = new URL(opts.baseUrl).origin
  const csp =
    `default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' blob: ${runtimeOrigin}; ` +
    `worker-src blob:; connect-src ${runtimeOrigin}; child-src blob:`
  const script = `
var N=${JSON.stringify(opts.nonce)},O=${JSON.stringify(opts.parentOrigin)},BASE=${JSON.stringify(opts.baseUrl)},SRC=${JSON.stringify(PYTHON_SOURCE)};
var W=null;
function up(m){m.source=SRC;m.nonce=N;try{parent.postMessage(m,O)}catch(e){}}
try{
  W=new Worker(URL.createObjectURL(new Blob([${JSON.stringify(PYTHON_WORKER_SOURCE)}],{type:"text/javascript"})));
  W.onmessage=function(e){var d=e.data||{};up(d)};
  W.onerror=function(e){up({type:"worker-error",message:String(e.message||"The Python worker crashed.")})};
  W.postMessage({type:"init",base:BASE});
}catch(err){up({type:"init-error",message:String(err&&err.message||err)})}
window.addEventListener("message",function(e){
  if(e.source!==parent)return;var d=e.data;
  if(!d||d.nonce!==N||d.type!=="run"||!W)return;
  W.postMessage({type:"run",id:d.id,code:String(d.code)});
});`
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"></head><body><script>${script.replace(/<\/script/gi, "<\\/script")}</script></body></html>`
}
