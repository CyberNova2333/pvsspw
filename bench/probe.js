// Both players run on separate origins. Only game-worker events count as video.
(() => {
  // Old workbench versions linked directly into the baseline's secondary pages.
  // A plain /core.html still opens the reference player for comparison runs.
  if (location.pathname === '/core.html' && /^#\/(?:title|settings|about|import)(?:\/|$)/.test(location.hash)
      && !new URLSearchParams(location.search).has('baseline')) {
    location.replace('/' + location.search + location.hash);
    return;
  }
  const {engine, revision, sample} = PV_CONFIG;
  const epoch = () => performance.timeOrigin + performance.now();
  const documentId = crypto.randomUUID();
  const saveKey = 'pvsspw.save.' + revision + '.' + sample['PCSG00214.zip'].sha256;
  let run;
  function reset() {
    run = {
      engine, revision, sampleSha256: sample['PCSG00214.zip'].sha256, titleId: sample.titleId,
      documentId, userAgent: navigator.userAgent, isolated: crossOriginIsolated,
      started: null, firstFrameMs: null, events: 0, pictureConfirmed: false, pictureConfirmedMs: null,
      fpsWindow: null, save: null, fault: null, coreNotes: []
    };
  }
  reset();
  function start(title) {
    reset();
    if (title) { run.titleId = title.titleId; run.sampleSha256 = null; }
    run.started = epoch();
  }
  function endWindow(reason) {
    if (run.fpsWindow?.status === 'sampling') run.fpsWindow.status = reason;
  }
  function frame(time) {
    if (run.started === null || time < run.started) return;
    if (!run.events) run.firstFrameMs = Math.round(time - run.started);
    run.events++;
    const w = run.fpsWindow;
    if (w?.status === 'sampling' && time >= w.start && time < w.start + 600000) { w.frames++; w.lastFrame = time; }
  }
  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    constructor(url, options) {
      super(url, options);
      if (new URL(url, location.href).pathname !== '/worker.js') return;
      this.addEventListener('message', ({data}) => {
        if (engine === 'vita3k' && (data?.type === 'vita-present' || data?.type === 'vita-frame')) frame(epoch());
        if (engine === 'vitaslop' && data?.type === 'pvsspw-submit') frame(data.time);
        if (data?.type === 'log' && typeof data.message === 'string' && /missing function|unsupported|failed|reject|fatal|abort|stalled/i.test(data.message)) {
          const line = data.message.trim().slice(0,230);
          if (run.coreNotes.length < 12 && !run.coreNotes.includes(line)) run.coreNotes.push(line);
        }
        if (data?.type === 'vita-exit' || data?.type === 'vita-gxm-device') {
          run.fault = data.type === 'vita-exit' ? 'Guest exit '+data.exitCode : 'Graphics device: '+JSON.stringify(data.device);
          endWindow('interrupted');
        }
        if (['panic', 'error'].includes(data?.type)) {
          run.fault = String(data.message || data.type).slice(0, 500);
          endWindow('interrupted');
        }
      });
      this.addEventListener('error', e => { run.fault = e.message; endWindow('interrupted'); });
    }
  };
  document.addEventListener('click', event => {
    const b = event.target.closest?.('button, a');
    if (!b || b.closest('#pv-bench')) return;
    if (b.id === 'play' || b.textContent.trim() === 'Play' || b.getAttribute('aria-label')?.startsWith('Play ')) start();
  }, true);
  function onPlayPage() {
    return location.hash.includes('/play/' + sample.titleId);
  }
  function confirmPicture() {
    if (!onPlayPage() || !run.events || run.fault) throw Error('请先确认游戏画面已出现且采集到帧。');
    if (!run.pictureConfirmed) run.pictureConfirmedMs = Math.round(epoch() - run.started);
    run.pictureConfirmed = true;
  }
  function startWindow() {
    confirmPicture();
    if (document.hidden || run.fpsWindow?.status === 'sampling') throw Error('采样需要前台页面和新窗口。');
    run.fpsWindow = {start: epoch(), scene:'PCSG00214-first-battle-idle-v1', frames: 0, seconds: 600, status: 'sampling', fps: null, lastFrame: null};
    const w = run.fpsWindow;
    setTimeout(() => {
      if (w.status !== 'sampling') return;
      if (document.hidden || !onPlayPage() || run.fault) return endWindow('interrupted');
      if (!w.frames || epoch() - w.lastFrame > 15000) return endWindow('stalled');
      w.fps = w.frames / w.seconds;
      w.status = 'complete';
    }, 600000);
  }
  let lastRoute = location.hash;
  window.addEventListener('hashchange', () => {
    if (lastRoute.includes('/play/') && location.hash !== lastRoute) endWindow('left-game');
    lastRoute = location.hash;
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) endWindow('backgrounded'); });
  window.addEventListener('pagehide', () => endWindow('closed'));
  function saved(marker) {
    confirmPicture();
    if (!marker?.trim()) throw Error('请输入刚在游戏里写入的槽位和可辨识进度。');
    run.save = {status:'written-by-operator', marker:marker.trim(), documentId, at:Date.now()};
    localStorage.setItem(saveKey, JSON.stringify(run.save));
  }
  function loaded(marker) {
    confirmPicture();
    const before = JSON.parse(localStorage.getItem(saveKey) || 'null');
    if (!before || before.documentId === documentId || before.marker !== marker?.trim())
      throw Error('需要重新打开页面，并输入在游戏读档后看到的相同进度。');
    run.save = {status:'read-back-by-operator', written:before, readDocumentId:documentId, at:Date.now()};
    localStorage.removeItem(saveKey);
  }
  window.PVBench = {start, confirmPicture, startWindow, saved, loaded, result: () => structuredClone(run)};
  document.addEventListener('DOMContentLoaded', () => {
    const panel = document.createElement('details');
    panel.id = 'pv-bench';
    panel.style.cssText = 'position:fixed;bottom:env(safe-area-inset-bottom,0);left:0;z-index:2147483647;background:#202329;color:#fff;padding:4px;font:13px sans-serif;max-width:min(340px,95vw)';
    const title = document.createElement('summary');
    title.textContent = 'PVSSPW 对测';
    panel.append(title);
    const status = document.createElement('output');
    function control(label, action) {
      const b = document.createElement('button');
      b.textContent = label; b.style.cssText = 'margin:3px;padding:4px;color:inherit;background:#363b44';
      b.onclick = () => { try {action();status.textContent = '已记录';} catch(e) {status.textContent=e.message;} };
      panel.append(b);
    }
    control('确认游戏画面', confirmPicture);
    control('开始同一战斗场景 10 分钟采样', startWindow);
    control('场景变化，作废本轮', () => endWindow('scene-changed'));
    control('记录游戏内写档', () => saved(prompt('存档槽、章节及可辨识进度')));
    control('确认重开后读回', () => loaded(prompt('输入读档后看到的槽位、章节及进度')));
    control('导出本次 JSON', () => {
      const device = prompt('请记录实测机型、系统、浏览器版本，并注明实体机或虚拟机。');
      if (!device?.trim()) throw Error('导出前请填写设备来源。');
      const kind = prompt('设备类别：android-physical、ios-physical、android-emulator 或 desktop');
      if (!['android-physical','ios-physical','android-emulator','desktop'].includes(kind))
        throw Error('请选择有效的设备类别。');
      const cold = confirm('这次启动是本游戏刚导入后的第一次启动吗？读档重开或已运行过请选取消。');
      const record = { ...run, deviceClass:kind, coldBoot:cold,
        deviceEvidence: { source:'operator', description:device.trim() } };
      const url = URL.createObjectURL(new Blob([JSON.stringify(record,null,2)], {type:'application/json'}));
      const a = document.createElement('a'); a.href=url; a.download=engine+'-'+documentId+'.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
    panel.append(status);document.body.append(panel);
  });
})();
