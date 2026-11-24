import * as store from '/store.js';
import { entriesFromFiles, entriesFromDrop } from '/import.js';
import { storageRoom, requestPersistence } from '/opfs.js';
import { canPlay } from '/features.js';
import { checkPlatform } from './platform.js';
import { initOnlineGames } from './vendor/online-games.js';
import { install, patch, removeGame, readRepatch } from './library.js';
import { download, saves, exportSaves, restoreSaves, showTree } from './files.js';

import { probeGraphics } from './graphics.js';
import { createGamePages } from './game-pages.js';
import { mountInterfaceMotion } from './idle-motion.js';

const $ = (id) => document.getElementById(id);
const frame = $('engine');
const player = () => frame.contentWindow.vitaPlayer;
const tabs = [...document.querySelectorAll('[role=tab]')];
let tab = 'library',
  titles = [],
  selected = null,
  active = null,
  busy = false,
  patchTarget,
  restoreTarget;
let graphicsResult = {},
  checking = 0;
let features = [],
  featuresReady = false,
  adapter = null,
  rendering = 0,
  saveRender = 0,
  settingsRender = 0;
let focusBeforePanel = null,
  toastTimer,
  sampleStart = 0,
  lastFrames = 0;
const logs = [];
let measurement = null,
  latestRate = null,
  releaseSession = null;
function storageLock(work) {
  if (!navigator.locks) return work();
  return navigator.locks.request('pvsspw-library', { ifAvailable: true }, (lock) => {
    if (!lock) throw Error('另一标签页正在游玩或写入文件，请稍后再试');
    return work();
  });
}
function log(text) {
  logs.push(new Date().toLocaleTimeString() + '  ' + text);
  if (logs.length > 400) logs.shift();
  if (tab === 'log') showLog();
}
function status(text) {
  $('statusText').textContent = text;
  log(text);
}
function toast(text) {
  clearTimeout(toastTimer);
  $('toast').textContent = text;
  $('toast').classList.add('visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4500);
}
function fail(error) {
  const text = String(error?.message || error);
  status(text);
  toast(text);
}
function bind(id, event, fn) {
  $(id).addEventListener(event, (e) =>
    Promise.resolve()
      .then(() => fn(e))
      .catch(fail),
  );
}
function action(label, fn, disabled = false) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.disabled = disabled;
  b.onclick = () => Promise.resolve().then(fn).catch(fail);
  return b;
}
function rows(target, items) {
  const nodes = [];
  for (const [label, value] of items) {
    const dt = document.createElement('dt'),
      dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value ?? '—';
    nodes.push(dt, dd);
  }
  $(target).replaceChildren(...nodes);
}
function showLog() {
  const filter = $('filterLog').value.toLowerCase();
  $('messages').textContent =
    logs.filter((s) => s.toLowerCase().includes(filter)).join('\n') || '没有匹配的日志。';
}
function selectTab(name) {
  tab = name;
  for (const b of tabs) {
    const on = b.dataset.tab === name,
      section = $(b.getAttribute('aria-controls'));
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    section.hidden = !on;
    section.classList.toggle('active', on);
    if (on && document.body.classList.contains('panel-open')) {
      b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
  const update = {
    library: refreshLibrary,
    settings: showSettings,
    saves: showSaves,
    storage: showStorage,
    info: showInfo,
    log: showLog,
  }[name];
  if (update) Promise.resolve(update()).catch(fail);
}
function panel(open, name = tab) {
  if (open && !document.body.classList.contains('panel-open')) focusBeforePanel = document.activeElement;
  document.body.classList.toggle('panel-open', open);
  $('panelToggleBtn').setAttribute('aria-expanded', String(open));
  frame.inert = open;
  if (open) {
    fullscreenMenu(false);
    selectTab(name);
    tabs.find((b) => b.dataset.tab === name)?.focus();
  } else if (active) frame.focus();
  else (focusBeforePanel?.isConnected ? focusBeforePanel : $('panelToggleBtn')).focus();
}
for (const [idx, b] of tabs.entries()) {
  b.onclick = () => selectTab(b.dataset.tab);
  b.onkeydown = (e) => {
    const i = {
      ArrowRight: (idx + 1) % tabs.length,
      ArrowLeft: (idx + tabs.length - 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[e.key];
    if (i === undefined) return;
    e.preventDefault();
    tabs[i].click();
    tabs[i].focus();
  };
}
$('panelToggleBtn').onclick = () => panel(!document.body.classList.contains('panel-open'));
$('panelBackdrop').onclick = $('panelCloseBtn').onclick = () => panel(false);
document.addEventListener('keydown', (e) => {
  if ($('gamePage').open || !document.body.classList.contains('panel-open')) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    panel(false);
  }
  if (e.key === 'Tab') {
    const candidates = [
      ...$('sidePanel').querySelectorAll(
        'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
      ),
    ].filter((n) => n.tabIndex >= 0 && n.getClientRects().length);
    if (e.shiftKey && document.activeElement === candidates[0]) {
      e.preventDefault();
      candidates.at(-1)?.focus();
    } else if (!e.shiftKey && document.activeElement === candidates.at(-1)) {
      e.preventDefault();
      candidates[0]?.focus();
    }
  }
});
const themeMedia = matchMedia('(prefers-color-scheme:dark)');
function theme(dark, user = false) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  if (user) localStorage.setItem('pvsspw.theme', dark ? 'dark' : 'light');
  dayNight?.apply(dark);
  if (frame.contentDocument)
    frame.contentDocument.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
let dayNight;
const initialTheme = () =>
  localStorage.getItem('pvsspw.theme')
    ? localStorage.getItem('pvsspw.theme') === 'dark'
    : themeMedia.matches;
theme(initialTheme());
mountInterfaceMotion();
dayNight = window.DayNightSwitch.mount($('ppsspw-theme-switch'), {
  isDark: () => initialTheme(),
  onToggle: (v) => theme(v, true),
});
themeMedia.onchange = () => theme(initialTheme());
window.addEventListener('storage', (e) => {
  if (e.key === 'pvsspw.theme' || e.key === null) theme(initialTheme());
});
const compact = matchMedia(
  '(max-width:700px), (pointer:coarse) and (max-height:560px), (pointer:coarse) and (max-width:920px)',
);
function placeSwitch() {
  const widget = $('ppsspw-theme-switch');
  $('compactThemeSetting').hidden = !compact.matches;
  if (compact.matches) $('compactThemeSetting').append(widget);
  else $('panelToggleBtn').before(widget);
}
placeSwitch();
compact.addEventListener('change', placeSwitch);

async function fullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.querySelector('.body-main').requestFullscreen();
    if (matchMedia('(pointer:coarse)').matches && screen.orientation?.lock) {
      try {
        await screen.orientation.lock('landscape');
      } catch {
        toast('可旋转设备横屏游玩');
      }
    }
  } catch (e) {
    fail(e);
  }
}
document.addEventListener('fullscreenchange', () => {
  const full = !!document.fullscreenElement;
  document.body.classList.toggle('browser-fullscreen', full);
  $('fullExit').hidden = !full;
  fullscreenMenu(false);
  if (!full) screen.orientation?.unlock?.();
});
function fullscreenMenu(open) {
  $('fsMenuActions').hidden = $('fsMenuBackdrop').hidden = !open;
  $('fsMenuToggle').setAttribute('aria-expanded', String(open));
}
$('fullscreenBtn').onclick = $('fullExit').onclick = $('fsExit').onclick = fullscreen;
$('fsMenuToggle').onclick = () => fullscreenMenu($('fsMenuActions').hidden);
$('fsMenuBackdrop').onclick = () => fullscreenMenu(false);
$('fsPanel').onclick = () => panel(true, 'library');
$('fsSaves').onclick = () => panel(true, 'saves');
$('fsPad').onclick = () => {
  fullscreenMenu(false);
  $('touchGamepadToggle').click();
};
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('fsMenuActions').hidden) {
    fullscreenMenu(false);
    $('fsMenuToggle').focus();
  }
});
window.addEventListener('vita-fullscreen', fullscreen);
window.addEventListener('vita-settings', () => panel(true, 'settings'));
window.addEventListener('vita-log', (e) => log(e.detail));
window.addEventListener('vita-frameflow', (e) => {
  updateFrameflowStatus(e.detail);
  updateGamesrStatus(e.detail);
});
function updateFrameflowStatus(s) {
  const node = $('frameflowStatus');
  if (!node) return;
  if (!s || s.preset === 'off') {
    node.textContent = s?.error
      ? 'GameFI 初始化失败：' + s.error
      : s?.softwareBlocked
        ? '软件渲染模式已禁用 AI 插帧。'
        : '实时光流插帧，开关即时生效，不重启游戏。';
    return;
  }
  if (s.loading) {
    node.textContent = `正在加载 GameFI (${s.label}) 模型…`;
    return;
  }
  if (s.thermalBypass) {
    node.textContent = `GameFI (${s.label}) · GPU 负载过高已自动直通`;
    return;
  }
  if (s.bypassing) {
    node.textContent = `GameFI (${s.label}) · 原生高帧率直通（${s.sourceFps} FPS）`;
    return;
  }
  const backend = s.backend ? `${s.backend.toUpperCase()} ${s.precision || ''}`.trim() : 'WebGPU';
  const fpsPart = s.outputFps > 0 ? ` · ${s.sourceFps}→${s.outputFps} FPS` : ' · 已就绪';
  const msPart = s.avgGpuMs > 0 ? ` · ${s.avgGpuMs} ms` : '';
  const tierPart = s.perfTier === 1 ? ' · 节能档' : '';
  node.textContent = `GameFI (${s.label}) · ${backend}${fpsPart}${msPart}${tierPart}`;
}
function updateGamesrStatus(s) {
  const node = $('gamesrStatus');
  if (!node) return;
  if (!s || !s.srPreset || s.srPreset === 'off') {
    node.textContent = s?.srError
      ? 'GameSR 初始化失败：' + s.srError
      : s?.softwareBlocked
        ? '软件渲染模式已禁用 AI 超分。'
        : '实时 2× AI 超分去马赛克，可单独开启或与插帧叠加。';
    return;
  }
  if (s.srLoading) {
    node.textContent = `正在加载 GameSR (${s.srLabel}) 模型…`;
    return;
  }
  const backend = s.backend ? `${s.backend.toUpperCase()} ${s.precision || ''}`.trim() : 'WebGPU';
  const dimPart = s.width > 0 && s.srOutW > 0 ? ` · ${s.width}×${s.height}→${s.srOutW}×${s.srOutH}` : ' · 已就绪';
  const msPart = s.avgSrMs > 0 ? ` · ${s.avgSrMs} ms` : '';
  node.textContent = `GameSR (${s.srLabel}) · ${backend}${dimPart}${msPart}`;
}
function gamepadBadge() {
  const pads = Array.from(navigator.getGamepads?.() || []).filter((p) => p?.connected);
  const value = localStorage.getItem('pvsspw.padDevice') || '';
  const options = [new Option('自动选择已连接手柄', '')];
  for (const p of pads)
    options.push(new Option(p.index + 1 + ' · ' + p.id, JSON.stringify([p.index, p.id])));
  if (value && options.every((o) => o.value !== value))
    options.push(new Option('所选手柄已断开', value));
  $('padDevice').replaceChildren(...options);
  $('padDevice').value = value;
  const pad = value ? pads.find((p) => JSON.stringify([p.index, p.id]) === value) : pads[0];
  $('gamepadBadge').lastChild.textContent = pad ? '已连接手柄' : '未连接手柄';
  $('gamepadBadge').title = pad?.id || '未连接手柄';
}
bind('padDevice', 'change', (e) => {
  const value = e.target.value;
  localStorage.setItem('pvsspw.padDevice', value);
  player()?.choosePad(value);
  gamepadBadge();
});
bind('gpuPreference', 'change', (e) => {
  localStorage.setItem('pvsspw.gpu', e.target.value);
  if (!active) detectEnvironment().catch(fail);
  return showSettings();
});
function syncGpuBadgeMarquee() {
  const badge = $('gpuBadge');
  if (!badge) return;
  const vp = badge.querySelector('.badge-marquee-viewport');
  const tr = badge.querySelector('.badge-marquee-track');
  const txt = badge.querySelector('.badge-marquee-text');
  if (!vp || !tr || !txt) return;
  if (txt.scrollWidth > vp.clientWidth + 2) {
    badge.classList.add('is-overflowing');
    if (!tr.querySelector('.badge-marquee-dup')) {
      const sep = document.createElement('span');
      sep.className = 'badge-marquee-sep';
      sep.textContent = '　·　';
      const dup = document.createElement('span');
      dup.className = 'badge-marquee-dup';
      dup.textContent = txt.textContent;
      dup.setAttribute('aria-hidden', 'true');
      tr.append(sep, dup);
    } else {
      tr.querySelector('.badge-marquee-dup').textContent = txt.textContent;
    }
  } else {
    badge.classList.remove('is-overflowing');
    tr.querySelector('.badge-marquee-sep')?.remove();
    tr.querySelector('.badge-marquee-dup')?.remove();
  }
}
window.addEventListener('resize', syncGpuBadgeMarquee, { passive: true });
function updateGpuBadge() {
  $('gpuBadge').querySelector('.badge-marquee-text').textContent = adapter
    ? 'WebGPU · ' +
      (adapter.vendor || '可用') +
      (adapter.software ? ' · 软件' : adapter.mode === 'compatibility' ? ' · 兼容' : '')
    : 'WebGPU 不可用';
  requestAnimationFrame(syncGpuBadgeMarquee);
}
window.addEventListener('vita-adapter', (e) => {
  adapter = { ...adapter, ...e.detail };
  updateGpuBadge();
});
window.addEventListener('gamepadconnected', gamepadBadge);
window.addEventListener('gamepaddisconnected', gamepadBadge);
gamepadBadge();

function state() {
  $('idleStartBtn').disabled = busy || (!!selected && !featuresReady);
  $('idleChooseBtn').hidden = !selected;
  $('launchProblem').querySelector('button').hidden = !!selected;
  $('idleActionText').textContent = selected ? playLabel() : '选择游戏';
  const detailPlay = $('gamePage').querySelector('[data-play-title]');
  if (detailPlay) detailPlay.textContent = playLabel();
  $('idleChooseIcon').hidden = !!selected;
  $('idlePlayIcon').hidden = !selected;
  $('idleSubtitle').textContent = selected
    ? selected.title + ' · ' + selected.titleId
    : '选择本地 PS Vita 游戏文件开始游玩。已有游戏和存档可在右上角的「游戏库与设置」中查看。';
  for (const id of ['emuMenu', 'backGame', 'shot', 'flush', 'quit', 'touchGamepadToggle', 'fsPad'])
    $(id).disabled = !active;
  $('retryEnvironment').disabled = !featuresReady || !!active;
  $('advanced').hidden = false;
  $('resetPrefs').disabled = !!active || busy;
  $('addFiles').disabled = $('folderPick').disabled = busy || !!active;
  $('advanced').href = '#/settings' + (selected ? '/' + encodeURIComponent(selected.titleId) : '');
}
window.addEventListener('vita-ready', () => {
  frame.contentDocument.documentElement.dataset.theme = document.documentElement.dataset.theme;
  state();
  drawLibrary();
});
async function refreshLibrary() {
  const ticket = ++rendering,
    list = await store.listTitles();
  if (ticket !== rendering) return;
  titles = list.sort((a, b) => (b.lastPlayedAt || b.importedAt) - (a.lastPlayedAt || a.importedAt));
  const last = selected?.titleId || localStorage.getItem('pvsspw.last');
  selected = titles.find((t) => t.titleId === last) || titles[0] || null;
  state();
  drawLibrary();
}
function drawLibrary() {
  const q = $('query').value.trim().toLowerCase(),
    nodes = [];
  for (const t of titles.filter((t) => (t.title + ' ' + t.titleId).toLowerCase().includes(q))) {
    const box = document.createElement('article'),
      head = document.createElement('div'),
      words = document.createElement('div');
    box.className = 'entry';
    head.className = 'entry-head';
    const name = document.createElement('strong'),
      detail = document.createElement('small');
    name.textContent = t.title;
    detail.textContent = t.titleId + ' · ' + store.fmtBytes(t.bytes);
    words.append(name, detail);
    head.append(words);
    box.append(head);
    if (t.hasIcon)
      store
        .titleImage(t.titleId)
        .then((url) => {
          if (url) {
            const img = new Image();
            img.src = url;
            img.alt = '';
            head.prepend(img);
          }
        })
        .catch(fail);
    const tools = document.createElement('div');
    tools.className = 'tools';
    const stop = busy || !!active;
    tools.append(
      action(playLabel(), () => launch(t), stop || !featuresReady),
      action(
        '导入 rePatch',
        () => {
          patchTarget = t;
          $('patchFile').click();
        },
        stop,
      ),
      action(
        '移除游戏',
        async () => {
          if (!confirm('移除 ' + t.title + ' 的游戏文件和补丁？游戏内存档会保留。')) return;
          await exclusive(() => removeGame(t));
          await refreshLibrary();
        },
        stop,
      ),
    );
    const more = document.createElement('a');
    more.className = 'btn';
    more.href = '#/title/' + encodeURIComponent(t.titleId);
    more.textContent = '详情与附加内容';
    if (!active) tools.append(more);
    readRepatch(t.titleId)
      .then((r) => {
        if (r) detail.textContent += ' · rePatch ' + (r.disabled ? '已停用' : '已启用');
      })
      .catch(fail);
    box.append(tools);
    nodes.push(box);
  }
  $('titles').replaceChildren(
    ...(nodes.length
      ? nodes
      : [q ? '未找到匹配的游戏。' : '游戏库还是空的。添加本地游戏文件即可开始。']),
  );
}
async function exclusive(work) {
  if (busy || active) throw Error('请先结束当前游玩或等待文件操作完成');
  busy = true;
  state();
  drawLibrary();
  try {
    return await storageLock(work);
  } finally {
    busy = false;
    state();
    drawLibrary();
  }
}
async function add(entries) {
  if (!entries.length) return;
  panel(true, 'library');
  const bar = $('importProgress');
  bar.hidden = false;
  bar.removeAttribute('value');
  try {
    const t = await exclusive(() =>
      install(entries, (text, n) => {
        $('importStatus').textContent = text;
        if (n != null) {
          bar.max = 1;
          bar.value = n;
        }
      }),
    );
    selected = t;
    localStorage.setItem('pvsspw.last', t.titleId);
    $('importStatus').textContent = '已导入 ' + t.title;
    status('已导入 ' + t.titleId);
    await refreshLibrary();
  } catch (e) {
    $('importStatus').textContent = '导入失败 · ' + e.message;
    throw e;
  } finally {
    bar.hidden = true;
  }
}
$('idleStartBtn').onclick = () => (selected ? launch(selected).catch(fail) : $('gameFile').click());
$('addFiles').onclick = $('idleChooseBtn').onclick = () => $('gameFile').click();
$('folderPick').onclick = () => $('folderFiles').click();
for (const id of ['gameFile', 'folderFiles'])
  bind(id, 'change', async (e) => {
    const entries = entriesFromFiles(e.target.files);
    e.target.value = '';
    await add(entries);
  });
bind('patchFile', 'change', async (e) => {
  const file = e.target.files[0],
    t = patchTarget;
  e.target.value = '';
  if (!file || !t) return;
  await exclusive(() => patch(t, file));
  status(t.titleId + ' 的 rePatch 已导入');
  await refreshLibrary();
});
bind('libraryRefresh', 'click', refreshLibrary);
$('query').oninput = drawLibrary;
for (const name of ['dragover', 'drop'])
  document.addEventListener(name, (e) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    if (name === 'drop' && !active && !busy) entriesFromDrop(e.dataTransfer).then(add).catch(fail);
  });
const online = initOnlineGames({
  canPlay: () => !active && !busy,
  play: (f) => globalThis.PpssppGameStorage.withShared(() => add(entriesFromFiles([f]))).catch(fail),
  reportError: toast,
});

async function launch(t) {
  if (!t || active || busy) return;
  if (!featuresReady || !player() || !canPlay(features)) {
    if (featuresReady && canPlay(features) && !player())
      $('environmentResult').textContent = '播放器尚未加载完成，请刷新工作台后重新检测。';
    panel(true, 'info');
    return;
  }
  if (
    graphicsResult.adapter.software &&
    !confirm('当前只有软件 WebGPU 设备，游戏可能很慢。使用软件渲染启动？')
  )
    return;
  selected = active = t;
  localStorage.setItem('pvsspw.last', t.titleId);
  document.body.classList.add('emulator-started');
  frame.hidden = false;
  panel(false);
  status('正在启动 ' + t.title);
  latestRate = null;
  sampleStart = performance.now();
  lastFrames = 0;
  state();
  try {
    await new Promise((resolve, reject) => {
      storageLock(
        () =>
          new Promise((release) => {
            releaseSession = release;
            resolve();
          }),
      ).catch(reject);
    });
    await player().start(t, graphicsResult.adapter);
    await showSettings();
    frame.focus();
  } catch (e) {
    if (releaseSession) player().stop();
    else ended();
    throw e;
  }
}
function ended() {
  if (!active) return;
  if (measurement?.running) stopMeasurement('已退出游戏');
  releaseSession?.();
  releaseSession = null;
  active = null;
  frame.hidden = true;
  document.body.classList.remove('emulator-started');
  status('已退出游戏');
  if (graphicsResult.preference !== (localStorage.getItem('pvsspw.gpu') || ''))
    detectEnvironment().catch(fail);
  state();
  refreshLibrary().catch(fail);
}
window.addEventListener('vita-exit', ended);
$('emuMenu').onclick = () => {
  panel(false);
  player().menu();
};
$('backGame').onclick = () => {
  panel(false);
  player().resume();
};
$('quit').onclick = () => {
  if (confirm('退出本局？尚未在游戏中保存的进度会丢失。')) player().stop();
};
$('shot').onclick = () => player().screenshot();
bind('flush', 'click', () => {
  player().flush();
  status('已请求核心写入游戏内存档');
});
async function showSettings() {
  const ticket = ++settingsRender,
    id = (active || selected)?.titleId;
  const v = await store.effective(id);
  if (ticket !== settingsRender) return;
  gamepadBadge();
  $('gpuPreference').value = localStorage.getItem('pvsspw.gpu') || '';
  $('scaling').value = v.scaling;
  $('outputResolution').value = localStorage.getItem('pvsspw.output') || 'native';
  $('fsr1').checked = localStorage.getItem('pvsspw.fsr1') === 'on';
  $('frameflow').value = localStorage.getItem('pvsspw.frameflow') || 'off';
  $('gamesr').value = localStorage.getItem('pvsspw.gamesr') || 'off';
  updateFrameflowStatus(active ? player()?.reports?.frameflow : null);
  updateGamesrStatus(active ? player()?.reports?.frameflow : null);
  $('dpadBehavior').value = localStorage.getItem('pvsspw.dpad') || 'step';
  $('showFps').checked = v.showFps;
  $('padMode').value = v.pad.mode;
  $('opacity').value = v.pad.opacity;
  $('opacityValue').value = Math.round(v.pad.opacity * 100) + '%';
  $('mute').checked = localStorage.getItem('vitaslop.muted') === '1';
  $('rear').checked = !!v.rearTouch;
  $('pauseBlur').checked = v.pauseOnBlur;
  $('touchGamepadToggle').setAttribute(
    'aria-pressed',
    String(
      v.pad.mode === 'overlay' ||
        v.pad.mode === 'beside' ||
        (v.pad.mode === 'auto' && matchMedia('(pointer:coarse)').matches),
    ),
  );
  $('fsPad').setAttribute('aria-pressed', $('touchGamepadToggle').getAttribute('aria-pressed'));
  $('settingStatus').textContent =
    (id ? '当前游戏 ' + id : '全局设置') + ' · 画面缩放与图形设备偏好在下次启动生效。';
  state();
}
bind('dpadBehavior', 'change', (e) => localStorage.setItem('pvsspw.dpad', e.target.value));
bind('outputResolution', 'change', (e) => {
  localStorage.setItem('pvsspw.output', e.target.value);
  if (e.target.value === 'native') {
    $('fsr1').checked = false;
    localStorage.removeItem('pvsspw.fsr1');
  }
  player()?.resizeOutput?.();
});
bind('fsr1', 'change', (e) => {
  if (e.target.checked) {
    $('outputResolution').value = 'display';
    localStorage.setItem('pvsspw.output', 'display');
    localStorage.setItem('pvsspw.fsr1', 'on');
    $('gamesr').value = 'off';
    localStorage.removeItem('pvsspw.gamesr');
    player()?.setGameSr?.('off');
    if (!active) updateGamesrStatus(null);
  } else localStorage.removeItem('pvsspw.fsr1');
  player()?.resizeOutput?.();
});
bind('frameflow', 'change', (e) => {
  const preset = e.target.value || 'off';
  if (preset === 'off') localStorage.removeItem('pvsspw.frameflow');
  else localStorage.setItem('pvsspw.frameflow', preset);
  player()?.setFrameflow?.(preset);
  if (!active) updateFrameflowStatus(null);
});
bind('gamesr', 'change', (e) => {
  const preset = e.target.value || 'off';
  if (preset === 'off') {
    localStorage.removeItem('pvsspw.gamesr');
  } else {
    localStorage.setItem('pvsspw.gamesr', preset);
    if ($('fsr1').checked) {
      $('fsr1').checked = false;
      localStorage.removeItem('pvsspw.fsr1');
    }
  }
  player()?.setGameSr?.(preset);
  player()?.resizeOutput?.();
  if (!active) updateGamesrStatus(null);
});
function setOption(key, value) {
  const id = (active || selected)?.titleId;
  if (key === 'mute') localStorage.setItem('vitaslop.muted', value ? '1' : '0');
  else {
    const record = id ? store.titleSettings(id) : store.globalSettings();
    const next = ['mode', 'opacity'].includes(key)
      ? { ...record, pad: { ...record.pad, [key]: value } }
      : { ...record, [key]: value };
    if (id) store.saveTitleSettings(id, next);
    else store.saveGlobalSettings(next);
  }
  if (active) player().change(key, value);
  return showSettings();
}
for (const [id, key] of Object.entries({
  scaling: 'scaling',
  showFps: 'showFps',
  mute: 'mute',
  padMode: 'mode',
  opacity: 'opacity',
  rear: 'rearTouch',
  pauseBlur: 'pauseOnBlur',
}))
  bind(id, 'change', (e) =>
    setOption(
      key,
      e.target.type === 'checkbox'
        ? e.target.checked
        : id === 'opacity'
          ? Number(e.target.value)
          : e.target.value,
    ),
  );
$('opacity').oninput = (e) => {
  $('opacityValue').value = Math.round(100 * e.target.value) + '%';
};
bind('touchGamepadToggle', 'click', async () => {
  await showSettings();
  const visible = $('touchGamepadToggle').getAttribute('aria-pressed') === 'true';
  await setOption('mode', visible ? 'hidden' : 'overlay');
  frame.focus();
});
bind('resetPrefs', 'click', async () => {
  if (active || busy || !confirm('重置全局设置及所选游戏的设置？')) return;
  store.saveGlobalSettings({});
  if (selected) store.saveTitleSettings(selected.titleId, null);
  localStorage.removeItem('pvsspw.gpu');
  localStorage.removeItem('pvsspw.output');
  localStorage.removeItem('pvsspw.fsr1');
  localStorage.removeItem('pvsspw.frameflow');
  localStorage.removeItem('pvsspw.gamesr');
  localStorage.removeItem('pvsspw.dpad');
  localStorage.removeItem('pvsspw.padDevice');
  player()?.choosePad('');
  localStorage.removeItem('vitaslop.muted');
  localStorage.removeItem('pvsspw.theme');
  theme(initialTheme());
  await showSettings();
  status('设置已重置');
});

async function showSaves() {
  const ticket = ++saveRender,
    v = await store.effective((active || selected)?.titleId);
  if (ticket !== saveRender) return;
  saves.setProfile(v.profile);
  const ids = await saves.listSaved();
  const all = [...new Set([...ids, ...titles.map((t) => t.titleId)])];
  const nodes = await Promise.all(
    all.map(async (id) => {
      const info = await saves.info(id),
        title = titles.find((t) => t.titleId === id);
      const card = document.createElement('article'),
        name = document.createElement('strong'),
        detail = document.createElement('small');
      card.className = 'entry';
      name.textContent = title?.title || id;
      detail.textContent =
        id + ' · ' + (info ? store.fmtBytes(info.bytes) : '尚无存档') + ' · ' + v.profile;
      const tools = document.createElement('div');
      tools.className = 'tools';
      tools.append(
        action('导出存档', () => exportSaves(id), !info),
        action(
          '恢复此游戏',
          () => {
            restoreTarget = id;
            $('saveFile').click();
          },
          !!active || busy,
        ),
        action(
          '删除存档',
          async () => {
            if (!confirm('永久删除 ' + id + ' 在 ' + v.profile + ' 中的游戏存档？')) return;
            await exclusive(() => saves.clear(id));
            await showSaves();
          },
          !info || !!active || busy,
        ),
      );
      card.append(name, detail, tools);
      return card;
    }),
  );
  if (ticket !== saveRender) return;
  $('saveList').replaceChildren(
    ...(nodes.length ? nodes : ['还没有找到存档。游戏内保存后点「刷新」。']),
  );
  $('exportAll').disabled = !ids.length;
  $('restoreAll').disabled = !!active || busy;
}
bind('refreshSaves', 'click', showSaves);
bind('exportAll', 'click', () => exportSaves());
$('restoreAll').onclick = () => {
  restoreTarget = null;
  $('saveFile').click();
};
bind('saveFile', 'change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (await exclusive(() => restoreSaves(file, restoreTarget))) status('已恢复游戏存档');
  await showSaves();
});
async function showStorage() {
  const room = await storageRoom(),
    kept = await navigator.storage?.persisted?.();
  rows('usage', [
    ['已用', room && store.fmtBytes(room.usage)],
    ['可用', room && store.fmtBytes(room.free)],
    ['配额', room && store.fmtBytes(room.quota)],
    ['持久存储', kept ? '已获准' : '尚未获准'],
  ]);
  await showTree($('fileTree'), await navigator.storage.getDirectory(), fail);
}
bind('spaceRefresh', 'click', showStorage);
bind('persist', 'click', async () => {
  status((await requestPersistence()) ? '浏览器已授予持久存储' : '浏览器暂未授予持久存储');
  await showStorage();
});
bind('cleanDownloads', 'click', async () => {
  if (!confirm('清除在线下载的缓存与续传进度？已导入的游戏和存档将保留。')) return;
  await globalThis.PpssppGameStorage.withExclusive(async () => {
    online.reset();
    try {
      await (await navigator.storage.getDirectory()).removeEntry('game-downloads', { recursive: true });
    } catch (e) {
      if (e.name !== 'NotFoundError') throw e;
    }
  });
  status('下载缓存已清除');
  await showStorage();
});
function probe() {
  const record = frame.contentWindow.PVBench?.result();
  if (!record) return {};
  return record.started === null ? { revision: record.revision } : record;
}
function showInfo() {
  const p = probe(),
    w = player()?.reports || {};
  rows('deviceInfo', [
    ['核心', 'Vitaslop · ' + (p.revision || '').slice(0, 12)],
    [
      'WebGPU',
      adapter
        ? [adapter.vendor, adapter.architecture].filter(Boolean).join(' / ') || '可用'
        : '未检测到适配器',
    ],
    ['回退适配器', adapter ? String(adapter.isFallbackAdapter ?? '未知') : '—'],
    ['跨源隔离', crossOriginIsolated ? '已开启' : '未开启'],
    ['Wasm JSPI', typeof WebAssembly.Suspending === 'function' ? '可用' : '不可用'],
    ['逻辑处理器', navigator.hardwareConcurrency],
    ['游戏线程', active ? w.threading : null],
    ['当前游戏', active?.title || '未运行'],
    ['首个渲染提交', p.firstFrameMs != null ? p.firstFrameMs + ' ms' : null],
    ['核心帧率', w.fps],
    ['每秒渲染提交', latestRate],
    ['渲染提交数', p.events],
    ...features.filter((f) => f.level !== 'ok').map((f) => [f.id, f.text]),
  ]);
  showMeasurement();
}
function showMeasurement() {
  $('sampleStart').disabled = !active || measurement?.running === true;
  $('sampleStop').disabled = !measurement?.running;
  $('sampleExport').disabled = !measurement?.samples.length;
  $('sampleStatus').textContent = measurement
    ? (measurement.running ? '正在采样' : measurement.reason) +
      ' · ' +
      measurement.samples.length +
      ' 个样本'
    : '尚未开始采样';
}
function stopMeasurement(reason) {
  if (!measurement?.running) return;
  measurement.running = false;
  measurement.endedAt = Date.now();
  measurement.reason = reason;
  showMeasurement();
}
$('sampleStart').onclick = () => {
  if (!active || measurement?.running) return;
  measurement = { startedAt: Date.now(), running: true, reason: '', samples: [] };
  lastFrames = probe().events;
  sampleStart = performance.now();
  showMeasurement();
};
$('sampleStop').onclick = () => stopMeasurement('已停止');
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopMeasurement('页面进入后台，采样已停止');
});
bind('sampleExport', 'click', () =>
  download('pvsspw-performance.json', JSON.stringify(measurement, null, 2), 'application/json'),
);
bind('exportReport', 'click', () =>
  download(
    'pvsspw-diagnostics.json',
    JSON.stringify(
      {
        time: new Date().toISOString(),
        userAgent: navigator.userAgent,
        adapter,
        features,
        graphics: graphicsResult,
        titleId: probe().titleId ?? null,
        probe: probe(),
        reports: player()?.reports,
        measurement,
        logs,
      },
      null,
      2,
    ),
    'application/json',
  ),
);
$('filterLog').oninput = showLog;
$('clearLog').onclick = () => {
  logs.length = 0;
  showLog();
};
setInterval(() => {
  if (!active) return;
  const p = probe(),
    now = performance.now();
  if (p.events >= lastFrames && now > sampleStart) {
    latestRate = Math.round(((p.events - lastFrames) * 10000) / (now - sampleStart)) / 10;
    if (measurement?.running) {
      measurement.samples.push({
        time: Date.now(),
        intervalMs: Math.round(now - sampleStart),
        submissions: p.events - lastFrames,
        submissionsPerSecond: latestRate,
        coreFps: player()?.reports.fps ?? null,
      });
      if (measurement.samples.length >= 3600) stopMeasurement('已达到一小时采样上限');
    }
  }
  lastFrames = p.events;
  sampleStart = now;
  if (tab === 'info' && document.body.classList.contains('panel-open')) showInfo();
}, 1000);

function backendLaunchCommand(backend) {
  return `python3 scripts/open-edge.py --backend ${backend}`;
}
function updateBackendWindowUi(message) {
  const select = $('backendWindowSelect');
  const btn = $('openBackendWindowBtn');
  const hint = $('backendWindowStatus');
  const cmd = $('backendWindowCmd');
  if (!select || !btn || !hint || !cmd) return;
  const backend = select.value || 'webgpu';
  const localEdge = document.documentElement.hasAttribute('data-local-edge');
  cmd.textContent = backendLaunchCommand(backend);
  cmd.hidden = localEdge;
  btn.textContent = localEdge ? '打开指定后端窗口' : '复制启动命令';
  if (message) {
    hint.textContent = message;
  } else {
    hint.textContent = localEdge
      ? '使用独立浏览器配置目录启动对应图形后端，可与当前窗口同时打开。'
      : '当前服务未开启本机窗口启动器（--edge-launcher），可在 pvsspw 目录运行上方命令：';
  }
}
async function requestOpenBackendWindow(backend, titleId = '') {
  const validTitle = /^[A-Z0-9]{9}$/.test(titleId) ? titleId : '';
  const localEdge = document.documentElement.hasAttribute('data-local-edge');
  if (!localEdge) {
    const command = backendLaunchCommand(backend) + (validTitle ? ` ${validTitle}` : '');
    try {
      await navigator.clipboard?.writeText(command);
      updateBackendWindowUi(`已复制启动命令：${command}`);
      status('已复制指定后端启动命令');
    } catch (_) {
      updateBackendWindowUi(`请在本机 pvsspw 目录执行：${command}`);
    }
    return;
  }
  const response = await fetch('/__local/open-edge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-PVSSPW-Action': 'open-edge' },
    body: JSON.stringify(validTitle ? { backend, title: validTitle } : { backend }),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {}
  if (!response.ok) {
    throw Error(payload?.error || `无法打开指定后端窗口 · ${response.status}`);
  }
  const label = payload?.label || backend;
  updateBackendWindowUi(`已请求打开「${label}」新窗口（独立配置与存档）。`);
  status(`已请求打开 ${label} 新窗口`);
}
$('backendWindowSelect')?.addEventListener('change', () => updateBackendWindowUi());
$('openBackendWindowBtn')?.addEventListener('click', () => {
  const btn = $('openBackendWindowBtn');
  const backend = $('backendWindowSelect')?.value || 'webgpu';
  btn.disabled = true;
  Promise.resolve(requestOpenBackendWindow(backend, selected?.titleId || ''))
    .catch((err) => {
      updateBackendWindowUi(String(err?.message || err));
      fail(err);
    })
    .finally(() => {
      btn.disabled = false;
    });
});
$('openBackendDiagnosticsBtn')?.addEventListener('click', () => {
  panel(true, 'info');
  $('backendWindowSelect')?.focus({ preventScroll: true });
});
updateBackendWindowUi();

function playLabel() {
  if (!featuresReady) return '正在检测…';
  if (!canPlay(features) || !player()) return '查看启动问题';
  return graphicsResult.adapter?.software ? '使用软件渲染启动' : '开始游玩';
}
const fixes = {
  secure: '请用 HTTPS 或本机 127.0.0.1 打开工作台。',
  jspi: '当前浏览器缺少 WebAssembly JSPI，请更新 Edge 并重启。',
  wasm: '当前浏览器缺少 WebAssembly。',
  opfs: '请允许此站点使用浏览器本地存储，并确认磁盘可用空间。',
  offscreen: '此浏览器不能将画布交给渲染线程，请更新浏览器。',
};
async function detectEnvironment() {
  const ticket = ++checking;
  const preference = localStorage.getItem('pvsspw.gpu') || '';
  featuresReady = false;
  $('launchProblem').hidden = true;
  state();
  drawLibrary();
  $('retryEnvironment').disabled = true;
  $('environmentResult').textContent = '正在检测游戏工作线程和浏览器能力…';
  try {
    const [checks, graphics] = await Promise.all([checkPlatform(), probeGraphics(preference)]);
    if (ticket !== checking) return;
    graphicsResult = { ...graphics, preference };
    adapter = graphics.adapter || null;
    const info = adapter
      ? { id: 'webgpu', level: 'ok', text: 'WebGPU 设备可用' }
      : { id: 'webgpu', level: 'fatal', text: graphics.reason };
    features = [...checks, info];
  } catch (e) {
    if (ticket !== checking) return;
    adapter = null;
    graphicsResult = {};
    features = [{ id: 'environment', level: 'fatal', text: e.message }];
  }
  if (ticket !== checking) return;
  featuresReady = true;
  $('retryEnvironment').disabled = !!active;
  const bad = features.filter((f) => f.level === 'fatal');
  updateGpuBadge();
  const reason = bad.map((f) => fixes[f.id] || f.text).join(' ');
  $('launchProblem').hidden = !reason;
  $('launchProblem').querySelector('span').textContent = reason;
  $('environmentResult').textContent =
    reason ||
    (adapter.software
      ? '检测到软件 WebGPU，可选择以软件渲染启动。此模式最多每秒显示 30 帧。'
      : '游戏工作线程已成功创建 WebGPU 设备。');
  const help = $('environmentHelp');
  help.replaceChildren();
  if ((!adapter || adapter.software) && isSecureContext) {
    const p = document.createElement('p');
    p.textContent = /EdgA\//.test(navigator.userAgent)
      ? '请更新 Android 版 Edge 和系统，重启 Edge 后重新检测。在 edge://gpu 可查看此设备的图形状态。'
      : /Edg\//.test(navigator.userAgent)
      ? '在桌面 Edge 的 edge://settings/system 开启图形加速，重启后在 edge://gpu 查看 WebGPU 状态，再回到这里重新检测。'
      : '请检查浏览器的图形加速设置和显卡驱动，重启浏览器后重新检测。';
    help.append(p);
    if (
      /Linux/.test(navigator.userAgent) &&
      !/Android/.test(navigator.userAgent) &&
      /Edg\//.test(navigator.userAgent)
    ) {
      const hint = document.createElement('p'),
        cmd = document.createElement('code');
      hint.textContent = '专用 Edge 窗口使用独立的游戏库和存档，可与当前浏览器同时打开。';
      if (document.documentElement.hasAttribute('data-local-edge')) {
        const open = action('打开 WebGPU 游玩窗口', async () => {
          open.disabled = true;
          try {
            await requestOpenBackendWindow('webgpu', selected?.titleId || '');
          } finally {
            open.disabled = false;
          }
        });
        help.prepend(open, hint);
      } else {
        cmd.textContent = 'python3 scripts/open-edge.py --backend webgpu';
        help.append(hint, document.createTextNode('在本机 pvsspw 项目目录运行 '), cmd);
      }
    }
  }
  const list = $('gpuAttempts').querySelector('ul');
  list.replaceChildren();
  for (const a of graphicsResult.attempts || []) {
    const li = document.createElement('li');
    li.textContent = [
      a.powerPreference || '默认',
      a.featureLevel || (a.forceFallbackAdapter ? '软件回退' : '标准'),
      a.result,
    ].join(' · ');
    list.append(li);
  }
  $('gpuAttempts').hidden = !list.children.length;
  if (reason) status(reason);
  else if (!active) status('启动环境已就绪');
  state();
  drawLibrary();
  showInfo();
}
$('launchProblem').querySelector('button').onclick = () => panel(true, 'info');
$('retryEnvironment').onclick = () => {
  if (!active) detectEnvironment().catch(fail);
};
function pageBack() {
  if (history.state?.pvPage) history.back();
  else {
    history.replaceState(null, '', location.pathname + location.search);
    pages.close();
  }
}
function navigate(kind, id) {
  const url = '#/' + kind + (id ? '/' + encodeURIComponent(id) : '');
  if (location.hash !== url) history.pushState({ pvPage: true }, '', url);
  route().catch(fail);
}
function leavePage() {
  pages.close();
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}
const pages = createGamePages({
  exclusive,
  refresh: refreshLibrary,
  notice: status,
  navigate,
  back: pageBack,
  isPlaying: () => !!active,
  playText: playLabel,
  play: (t) => {
    leavePage();
    launch(t).catch(fail);
  },
  openSaves: (t) => {
    leavePage();
    selected = t;
    panel(true, 'saves');
  },
});
async function route() {
  const [, kind, param] = location.hash.split('/');
  const id = param && decodeURIComponent(param);
  const t = id && titles.find((t) => t.titleId === id);
  if (!kind) {
    pages.close();
    return;
  }
  if (kind === 'settings') {
    panel(true, 'settings');
    if (id && !t) return pages.missing(id);
    await pages.mapping(id || null, t);
    return;
  }
  if (kind === 'title' || (kind === 'import' && id)) {
    panel(true, 'library');
    if (!t) return pages.missing(id);
    await pages.details(t, kind === 'import');
    return;
  }
  pages.close();
  if (kind === 'diagnostics') panel(true, 'info');
  else if (kind === 'play' && t) {
    if (!active) await launch(t);
  } else if (kind === 'import' || kind === 'about') panel(true, kind === 'import' ? 'library' : 'about');
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#/"]');
  if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const [, kind, id] = a.hash.split('/');
  navigate(kind, id && decodeURIComponent(id));
});
window.addEventListener('hashchange', () => route().catch(fail));
await refreshLibrary().catch(fail);
await detectEnvironment();
await route().catch(fail);
