/**
 * Source of the Web Worker that hosts Pyodide. It is created from a Blob INSIDE the sandboxed frame,
 * so it has an opaque origin: no cookies, no app storage. Network access is limited by the frame's CSP.
 * Each run gets fresh globals, like a new `python file.py` process.
 */
export const PYTHON_WORKER_SOURCE = String.raw`
var py = null, current = 0;
function post(m) { self.postMessage(m); }
async function init(base) {
  importScripts(base + "pyodide.js");
  py = await self.loadPyodide({ indexURL: base });
  py.setStdout({ batched: function (t) { post({ type: "stdout", id: current, text: t }); } });
  py.setStderr({ batched: function (t) { post({ type: "stderr", id: current, text: t }); } });
  py.setStdin({ stdin: function () { return undefined; } }); // no interactive input: input() raises EOFError
}
self.onmessage = async function (e) {
  var m = e.data;
  if (m.type === "init") {
    try { await init(m.base); post({ type: "ready" }); }
    catch (err) { post({ type: "init-error", message: String(err && err.message || err) }); }
    return;
  }
  if (m.type === "run") {
    current = m.id;
    var g = null;
    try {
      g = py.globals.get("dict")();
      g.set("__name__", "__main__");
      try { await py.loadPackagesFromImports(m.code, { messageCallback: function () {}, errorCallback: function (t) { post({ type: "stderr", id: current, text: t }); } }); }
      catch (pkgErr) { post({ type: "stderr", id: current, text: "Note: could not load a package: " + String(pkgErr && pkgErr.message || pkgErr) }); }
      await py.runPythonAsync(m.code, { globals: g });
      py.runPython("import sys; sys.stdout.flush(); sys.stderr.flush()");
      post({ type: "done", id: m.id });
    } catch (err) {
      try { py.runPython("import sys; sys.stdout.flush()"); } catch (_) {}
      post({ type: "error", id: m.id, message: String(err && err.message || err) });
    } finally {
      try { if (g) g.destroy(); } catch (_) {}
    }
  }
};
`
