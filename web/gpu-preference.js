import { adapterOptions } from './graphics.js';
const query = new URL(self.location.href).searchParams;
const mode = query.get('uiMode'),
  power = query.get('uiGpu');
if (navigator.gpu && ['core', 'compatibility', 'fallback'].includes(mode)) {
  const request = navigator.gpu.requestAdapter.bind(navigator.gpu);
  navigator.gpu.requestAdapter = async (options) => {
    const adapter = await request(adapterOptions(mode, power, options));
    if (adapter) {
      if (mode === 'compatibility' || adapter.featureLevel === 'compatibility')
        self.__vitaslopWebgpuCompat = true;
      const { vendor, architecture, isFallbackAdapter } = adapter.info || {};
      self.postMessage({ type: 'pv-ui-adapter', adapter: { vendor, architecture, isFallbackAdapter } });
    }
    return adapter;
  };
}
