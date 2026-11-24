// Negotiate on a dedicated worker, like the renderer. Keep the selected options for its actual requests.
export async function findGraphics(gpu, preference) {
  const attempts = [];
  if (!gpu) return { attempts, reason: '当前游戏工作线程没有 WebGPU API' };
  const powers = [...new Set([preference || 'high-performance', '', 'low-power', 'high-performance'])];
  let software;
  for (const mode of ['core', 'compatibility', 'fallback']) {
    for (const power of mode === 'fallback' ? [''] : powers) {
      const options = adapterOptions(mode, power);
      try {
        const adapter = await gpu.requestAdapter(options);
        if (!adapter) {
          attempts.push({ ...options, result: '未找到适配器' });
          continue;
        }
        const info = adapter.info || {};
        const soft = !!(
          info.isFallbackAdapter ||
          adapter.isFallbackAdapter ||
          mode === 'fallback' ||
          /swiftshader|llvmpipe|lavapipe|softpipe|warp|basic render|microsoft basic/i.test(
            [info.vendor, info.architecture, info.description].join(' '),
          )
        );
        const match = {
          mode,
          power,
          software: soft,
          vendor: info.vendor,
          architecture: info.architecture,
          isFallbackAdapter: info.isFallbackAdapter ?? adapter.isFallbackAdapter,
        };
        if (software && soft) {
          attempts.push({ ...options, result: '软件适配器' });
          continue;
        }
        const device = await adapter.requestDevice();
        device.destroy();
        attempts.push({ ...options, result: soft ? '软件设备可用' : '设备可用' });
        if (!soft) return { adapter: match, attempts };
        software ??= match;
      } catch (e) {
        attempts.push({ ...options, result: e.message || String(e) });
      }
    }
  }
  return software
    ? { adapter: software, attempts }
    : { attempts, reason: '浏览器未提供可创建设备的 WebGPU 适配器' };
}
export function adapterOptions(mode, power, original = {}) {
  const options = { ...original };
  if (power) options.powerPreference = power;
  else delete options.powerPreference;
  if (mode === 'compatibility') options.featureLevel = 'compatibility';
  if (mode === 'fallback') options.forceFallbackAdapter = true;
  return options;
}
export function probeGraphics(preference) {
  return new Promise((resolve) => {
    const w = new Worker('/ui/graphics-probe.js', { type: 'module' });
    const finish = (result) => {
      clearTimeout(timer);
      w.terminate();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ attempts: [], reason: '图形设备检测超时' }), 12000);
    w.onmessage = (e) => finish(e.data);
    w.onerror = (e) => finish({ attempts: [], reason: e.message || '图形检测工作线程启动失败' });
    w.postMessage(preference);
  });
}
