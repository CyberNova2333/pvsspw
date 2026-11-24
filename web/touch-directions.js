import { mountTouchPad as mountNativePad } from '/touchpad.js';

const directions = ['up', 'right', 'down', 'left'];
const holdDelay = 600;

export function mountTouchPad(root, worker, keymap, options = {}) {
  const pad = mountNativePad(root, worker, keymap, options);
  const listeners = new AbortController();
  const held = new Map();
  let map = keymap;
  function release(button) {
    const touch = held.get(button);
    if (!touch) return;
    clearTimeout(touch.timer);
    if (touch.continuous) worker.postMessage({ type: 'pv-direction-repeat', direction: touch.direction, pressed: false });
    held.delete(button);
    button.classList.remove('held');
  }
  function releaseAll() {
    for (const button of held.keys()) release(button);
  }
  function handle(event) {
    const button = event.target.closest('[data-btn]');
    const direction = directions.indexOf(button?.dataset.btn);
    if (direction === -1) return;
    const current = held.get(button);
    const mode = localStorage.getItem('pvsspw.dpad');
    if (!current && (event.type !== 'pointerdown' || !map[button.dataset.btn] || mode === 'hold')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type !== 'pointerdown') {
      if (current?.id === event.pointerId) release(button);
      return;
    }
    if (current || event.button !== 0) return;
    const touch = { id: event.pointerId, direction, continuous: false };
    held.set(button, touch);
    button.classList.add('held');
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers drop capture when the touch moves outside the viewport.
    }
    worker.postMessage({ type: 'pv-direction-step', direction });
    if (options.vibrate) {
      try { navigator.vibrate?.(8); } catch {}
    }
    if (mode === 'single') return;
    touch.timer = setTimeout(() => {
      touch.continuous = true;
      worker.postMessage({ type: 'pv-direction-repeat', direction, pressed: true });
    }, holdDelay);
  }
  const signal = listeners.signal;
  for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture'])
    root.addEventListener(type, handle, { capture: true, signal });
  function releaseOutside(event) {
    for (const [button, touch] of held) {
      if (touch.id === event.pointerId && !button.contains(event.target)) release(button);
    }
  }
  for (const type of ['pointerup', 'pointercancel'])
    window.addEventListener(type, releaseOutside, { capture: true, signal });
  window.addEventListener('blur', releaseAll, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); }, { signal });
  return {
    ...pad,
    setKeymap(next) { map = next; pad.setKeymap(next); },
    destroy() { releaseAll(); listeners.abort(); pad.destroy(); },
  };
}
