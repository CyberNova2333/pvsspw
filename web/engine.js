// This document keeps the upstream player, audio and OffscreenCanvas in one realm.
import { createPlayer } from '/workbench-player.js';
import { effective, saveTitleSettings, titleSettings } from '/store.js';
import { download } from './files.js';
import { chooseThreadPolicy } from './thread-policy.js';

const el = (id) => document.getElementById(id);
const notify = (type, detail) => parent.dispatchEvent(new CustomEvent('vita-' + type, { detail }));
let graphics,
  meta,
  worker,
  generation = 0;
const reports = {};
const threadModes = { manual: '手动', game: '同游戏与设备实测', measured: '并行测速', budget: '设备预算' };
const softwareScreen = el('softwareScreen');
let displayContext;
let outputSize;
function presentSoftwareFrame({ width, height, rgba }) {
  if (softwareScreen.width !== width) softwareScreen.width = width;
  if (softwareScreen.height !== height) softwareScreen.height = height;
  displayContext ??= softwareScreen.getContext('2d', { alpha: false, willReadFrequently: true });
  displayContext.putImageData(new ImageData(rgba, width, height), 0, 0);
  const gameCanvas = el('screen');
  softwareScreen.style.width = gameCanvas.style.width;
  softwareScreen.style.height = gameCanvas.style.height;
  softwareScreen.hidden = false;
}
let padDevice = localStorage.getItem('pvsspw.padDevice') || '';
const getPads = navigator.getGamepads?.bind(navigator);
if (getPads)
  navigator.getGamepads = () => {
    const pads = getPads();
    return padDevice
      ? Array.from(pads, (p) => (p && JSON.stringify([p.index, p.id]) === padDevice ? p : null))
      : pads;
  };
const NativeWorker = window.Worker;
window.Worker = class extends NativeWorker {
  constructor(url, options) {
    const endpoint = new URL(url, location.href);
    if (endpoint.pathname === '/worker.js' && graphics) {
      endpoint.searchParams.set('uiGpu', graphics.power);
      endpoint.searchParams.set('uiMode', graphics.mode);
      if (graphics.software) endpoint.searchParams.set('uiPresent', 'software');
      const ff = localStorage.getItem('pvsspw.frameflow') || 'off';
      if (ff && ff !== 'off') endpoint.searchParams.set('uiFrameflow', ff);
      const sr = localStorage.getItem('pvsspw.gamesr') || 'off';
      if (sr && sr !== 'off') endpoint.searchParams.set('uiSr', sr);
    }
    super(endpoint, options);
    if (endpoint.pathname !== '/worker.js') return;
    worker = this;
    this.terminated = new Promise((resolve) => {
      this.didTerminate = resolve;
    });
    this.addEventListener('message', ({ data }) => {
      if (worker !== this) return;
      if (data?.type === 'pv-ui-adapter') notify('adapter', data.adapter);
      if (data?.type === 'pvsspw-frameflow-stats') {
        const s = data.stats || {};
        reports.frameflow = s;
        notify('frameflow', s);
      }
      if (data?.type === 'pvsspw-software-frame') {
        try {
          presentSoftwareFrame(data);
        } finally {
          this.postMessage({ type: 'pvsspw-presented' });
        }
      }
      if (data?.type === 'pvsspw-capture-error') notify('log', '游戏画面读取失败 · ' + data.message);
      if (data?.type === 'report') reports[data.id] = String(data.text).slice(-10000);
      if (['note', 'panic', 'error'].includes(data?.type))
        notify('log', String(data.text || data.message).slice(0, 1200));
    });
  }
  terminate() {
    super.terminate();
    this.didTerminate?.();
  }
  postMessage(message, ...transfer) {
    if (message?.type === 'output-size') {
      outputSize = message;
      const srActive = (localStorage.getItem('pvsspw.gamesr') || 'off') !== 'off';
      const fsr1 = !srActive && localStorage.getItem('pvsspw.fsr1') === 'on' && localStorage.getItem('pvsspw.output') === 'display';
      message = { ...message, fsr1 };
      if (fsr1 && message.w === 0 && message.h === 0) {
        // Integer layout normally delegates the upscale to CSS. Give the GPU its actual destination.
        const box = el('screen').getBoundingClientRect();
        message.w = Math.round(box.width * devicePixelRatio);
        message.h = Math.round(box.height * devicePixelRatio);
      }
      if (message.w > 0 && message.h > 0 && (srActive || localStorage.getItem('pvsspw.output') !== 'display')) {
        const scale = Math.min(1, 960 / message.w, 544 / message.h);
        message = {
          ...message,
          w: Math.max(1, Math.round(message.w * scale)),
          h: Math.max(1, Math.round(message.h * scale)),
        };
      }
    }
    super.postMessage(message, ...transfer);
  }
};

function persist(patch) {
  const settings = titleSettings(meta.titleId);
  if (patch.pad) patch = { ...patch, pad: { ...settings.pad, ...patch.pad } };
  saveTitleSettings(meta.titleId, { ...settings, ...patch });
}
const player = createPlayer({
  async onExit() {
    const closing = worker,
      ticket = ++generation;
    // The native quit handler finishes its queued save and releases OPFS before terminating.
    await closing?.terminated;
    if (ticket !== generation) return;
    worker = null;
    softwareScreen.hidden = true;
    notify('exit');
  },
  onRestart() {
    start(meta).catch((error) => notify('log', error.message));
  },
});
async function start(title, selectedGraphics = graphics) {
  graphics = selectedGraphics;
  outputSize = null;
  softwareScreen.hidden = true;
  const ticket = ++generation;
  meta = title;
  padDevice = localStorage.getItem('pvsspw.padDevice') || '';
  const settings = await effective(title.titleId);
  if (ticket !== generation) return;
  const policy = await chooseThreadPolicy(settings.knobs, navigator, { titleId: title.titleId, adapter: graphics });
  if (ticket !== generation) return;
  if (policy.workers) settings.knobs.VITASLOP_SMP_WORKERS = String(policy.workers);
  if (graphics?.software) settings.knobs = { ...settings.knobs, VITASLOP_ALLOW_SOFTWARE_GPU: '1' };
  for (const key of Object.keys(reports)) delete reports[key];
  reports.threading = policy.mode === 'single'
    ? '单线程（手动）'
    : `多线程 · ${policy.workers} 个游戏执行线程（${threadModes[policy.mode]}）`;
  history.replaceState(null, '', '/engine.html#/play/' + encodeURIComponent(title.titleId));
  window.PVBench.start(title);
  await player.start(title, settings, { onSetting: persist });
  const ime = el('player').querySelector('.ime-bar input');
  if (ime) {
    ime.placeholder = '轻触输入';
    ime.setAttribute('aria-label', '向游戏输入文字');
  }
}
const controls = {
  showFps: 'm-fps',
  rearTouch: 'm-rear',
  pauseOnBlur: 'm-pause-blur',
  mode: 'm-pad-mode',
  opacity: 'm-pad-opacity',
  mute: 'm-mute',
};
window.vitaPlayer = {
  start,
  stop: () => player.stop(),
  reports,
  choosePad(value) {
    padDevice = value;
  },
  resizeOutput() {
    if (worker && outputSize) worker.postMessage(outputSize);
  },
  setFrameflow(preset) {
    if (worker) worker.postMessage({ type: 'pvsspw-frameflow', preset });
  },
  setGameSr(preset) {
    if (worker) worker.postMessage({ type: 'pvsspw-sr', preset });
  },
  menu() {
    if (el('menu').hidden) el('menubtn').click();
  },
  resume() {
    if (!el('menu').hidden) el('m-resume').click();
  },
  screenshot() {
    el('m-shot').click();
  },
  flush() {
    if (!worker) throw Error('核心尚未就绪');
    worker.postMessage({ type: 'flush-game-data' });
  },
  change(key, value) {
    const control = el(controls[key]);
    if (!control || !player.isRunning()) return;
    if (control.type === 'checkbox') control.checked = value;
    else control.value = value;
    control.dispatchEvent(new Event(key === 'opacity' ? 'input' : 'change', { bubbles: true }));
  },
};
// The shell manages fullscreen so its library and controls remain accessible.
el('m-shot').addEventListener('click', (e) => {
  if (softwareScreen.hidden) return;
  e.stopImmediatePropagation();
  softwareScreen.toBlob((blob) => {
    if (blob) download(meta.titleId + '-screenshot.png', blob);
  });
}, true);
el('m-fullscreen').addEventListener(
  'click',
  (e) => {
    e.stopImmediatePropagation();
    notify('fullscreen');
  },
  true,
);
el('m-settings').addEventListener('click', (e) => {
  e.preventDefault();
  notify('settings');
});
function menuLabels() {
  el('m-fullscreen').textContent = parent.document.fullscreenElement ? '退出全屏' : '全屏游玩';
}
new MutationObserver(menuLabels).observe(el('menu'), { attributes: true, attributeFilter: ['hidden'] });
parent.document.addEventListener('fullscreenchange', menuLabels);
for (const [id, text] of [
  ['m-restart', '重新开始本局？尚未在游戏中保存的进度会丢失。'],
  ['m-quit', '退出到游戏库？尚未在游戏中保存的进度会丢失。'],
])
  el(id).addEventListener('click', () => {
    el('m-confirm-text').textContent = text;
  });
notify('ready');
