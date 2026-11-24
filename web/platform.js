// The baseline uses its page-side WebGPU test. The workbench tests graphics separately in a render worker.
let filesystemCheck;
function testFilesystem() {
  if (!navigator.storage?.getDirectory) return Promise.resolve({ ok: false, err: '浏览器未开放 OPFS' });
  if (filesystemCheck) return filesystemCheck;
  filesystemCheck = new Promise((resolve) => {
    const worker = new Worker('/probe-worker.js');
    const finish = (result) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, err: '同步文件句柄检测超时' }), 5000);
    worker.onmessage = ({ data }) => finish(data);
    worker.onerror = (e) => finish({ ok: false, err: e.message });
    worker.postMessage(0);
  }).finally(() => {
    filesystemCheck = null;
  });
  return filesystemCheck;
}
export async function checkPlatform() {
  const fs = await testFilesystem();
  return [
    ['secure', isSecureContext, 'fatal', '安全上下文'],
    ['wasm', typeof WebAssembly !== 'undefined', 'fatal', 'WebAssembly'],
    ['jspi', typeof globalThis.WebAssembly?.Suspending === 'function', 'fatal', 'WebAssembly JSPI'],
    ['opfs', fs.ok, 'fatal', '本地存储同步文件句柄'],
    [
      'offscreen',
      typeof OffscreenCanvas !== 'undefined' && !!HTMLCanvasElement.prototype.transferControlToOffscreen,
      'fatal',
      '离屏画布',
    ],
    [
      'isolation',
      crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined',
      'warn',
      '跨源隔离与共享内存',
    ],
    ['audio', !!window.AudioContext && !!window.AudioWorklet, 'warn', '音频工作线程'],
    ['gamepad', !!navigator.getGamepads, 'warn', '实体手柄接口'],
    ['fullscreen', document.fullscreenEnabled || document.webkitFullscreenEnabled, 'warn', '全屏接口'],
  ].map(([id, ok, severity, label]) => ({
    id,
    level: ok ? 'ok' : severity,
    text: label + (ok ? '可用' : '不可用'),
    ...(id === 'opfs' && !ok ? { fix: fs.err } : {}),
  }));
}
