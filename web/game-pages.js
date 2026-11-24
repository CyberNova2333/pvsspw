import * as store from '/store.js';
import { entriesFromFiles, run, runRepatch } from '/import.js';
import {
  listAddons,
  setAddonEnabled,
  removeAddon,
  readRepatch,
  setRepatchEnabled,
  removeRepatch,
} from '/opfs.js';
import { listProfiles } from '/gamedata.js';

const names = {
  up: '方向上',
  down: '方向下',
  left: '方向左',
  right: '方向右',
  triangle: '△ 三角',
  square: '□ 方块',
  circle: '○ 圆圈',
  cross: '× 叉键',
  select: 'Select',
  start: 'Start',
  l: 'L 肩键',
  r: 'R 肩键',
};
const padLabels = {
  south: '下方按钮 (A / ×)',
  east: '右侧按钮 (B / ○)',
  west: '左侧按钮 (X / □)',
  north: '上方按钮 (Y / △)',
  dpad_up: '方向上',
  dpad_down: '方向下',
  dpad_left: '方向左',
  dpad_right: '方向右',
};
const el = (tag, text) => {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  return n;
};
function button(text, fn) {
  const b = el('button', text);
  b.type = 'button';
  b.onclick = fn;
  return b;
}
function section(title) {
  const group = el('section');
  group.className = 'page-group';
  group.append(el('h3', title));
  return group;
}
function picker(text, directory, accept, onFiles) {
  const label = el('label', text);
  label.className = 'btn file-pick';
  const f = el('input');
  f.type = 'file';
  f.multiple = true;
  f.accept = accept;
  f.webkitdirectory = directory;
  f.onchange = () => {
    const entries = entriesFromFiles(f.files);
    f.value = '';
    if (entries.length) onFiles(entries);
  };
  label.append(f);
  return label;
}
function field(text, input) {
  const l = el('label');
  l.className = 'page-field';
  l.append(el('span', text), input);
  return l;
}
function select(options, value) {
  const s = el('select');
  for (const [v, text] of options) s.add(new Option(text, v));
  s.value = value;
  return s;
}

export function createGamePages({
  exclusive,
  refresh,
  notice,
  navigate,
  back,
  play,
  playText,
  openSaves,
  isPlaying,
}) {
  const dialog = document.querySelector('#gamePage'),
    heading = dialog.querySelector('h2'),
    body = dialog.querySelector('.page-body'),
    note = dialog.querySelector('[role=status]');
  let generation = 0;
  document.querySelector('#pageBack').onclick = back;
  dialog.oncancel = (e) => {
    e.preventDefault();
    back();
  };
  function close() {
    generation++;
    if (dialog.open) dialog.close();
  }
  function begin(title, scope) {
    const ticket = ++generation;
    dialog.querySelector('.page-scope').textContent = scope;
    heading.textContent = title;
    body.replaceChildren();
    note.textContent = '';
    if (!dialog.open) dialog.showModal();
    body.scrollTop = 0;
    return ticket;
  }
  async function details(title, importing = false) {
    const id = title.titleId,
      ticket = begin(title.title, '游戏详情 · ' + id);
    const [addons, rp, icon] = await Promise.all([
      listAddons(id),
      readRepatch(id),
      store.titleImage(id),
    ]);
    if (ticket !== generation) return;
    const identity = el('div');
    identity.className = 'page-identity';
    if (icon) {
      const img = el('img');
      img.src = icon;
      img.alt = '';
      identity.append(img);
    }
    identity.append(
      el(
        'span',
        [id, title.appVersion && 'v' + title.appVersion, store.fmtBytes(title.bytes)]
          .filter(Boolean)
          .join(' · '),
      ),
    );
    const tools = el('div');
    tools.className = 'tools';
    const start = button(playText(), () => {
      close();
      play(title);
    });
    start.className = 'primary';
    start.dataset.playTitle = id;
    tools.append(
      start,
      button('按键映射', () => navigate('settings', id)),
      button('查看存档', () => {
        close();
        openSaves(title);
      }),
    );
    const overlay = section('rePatch 补丁'),
      addon = section('附加内容');
    const mutate = async (fn, message) => {
      const buttons = Array.from(body.querySelectorAll('button,input'));
      buttons.forEach((b) => (b.disabled = true));
      note.textContent = '正在处理文件…';
      try {
        await exclusive(fn);
        await refresh();
        notice(message);
        if (ticket === generation) {
          await details(title);
          note.textContent = message;
        }
        return true;
      } catch (e) {
        if (ticket === generation) note.textContent = e.message;
        notice(e.message);
      } finally {
        buttons.forEach((b) => (b.disabled = false));
      }
    };
    function installed(group, name, enabled, toggle, remove) {
      const row = el('div');
      row.className = 'installed-row';
      const label = el('strong', name);
      const on = el('input');
      on.type = 'checkbox';
      on.checked = enabled;
      on.onchange = async () => {
        const next = on.checked;
        if (!(await mutate(() => toggle(next), '启用状态已更新'))) on.checked = !next;
      };
      const del = button('移除', () => {
        if (confirm('移除 ' + name + '？')) mutate(remove, '已移除 ' + name);
      });
      row.append(label, field('启用', on), del);
      group.append(row);
    }
    if (rp)
      installed(
        overlay,
        rp.source || '已安装补丁',
        !rp.disabled,
        (v) => setRepatchEnabled(id, v),
        () => removeRepatch(id),
      );
    else overlay.append(el('p', '尚未安装 rePatch。'));
    const rpActions = el('div');
    rpActions.className = 'tools';
    for (const dir of [false, true])
      rpActions.append(
        picker(dir ? '选择补丁目录' : '选择补丁 ZIP', dir, '.zip', (entries) => {
          if (!dir && entries.length !== 1) {
            note.textContent = '请一次选择一个补丁 ZIP';
            return;
          }
          mutate(
            () => runRepatch(entries, id, { pickedRoot: dir, source: entries[0].path.split('/')[0] }),
            '补丁已安装',
          );
        }),
      );
    overlay.append(rpActions);
    if (!addons.length) addon.append(el('p', '尚未安装附加内容。'));
    for (const a of addons)
      installed(
        addon,
        a.title || a.dir,
        !a.disabled,
        (v) => setAddonEnabled(id, a.dir, v),
        () => removeAddon(id, a.dir),
      );
    const addActions = el('div');
    addActions.className = 'tools';
    for (const dir of [false, true])
      addActions.append(
        picker(dir ? '选择附加内容目录' : '选择附加内容文件', dir, '.pkg,.bin,.zip,.vpk', (entries) =>
          mutate(
            () =>
              run(
                entries,
                () => {},
                (p) => {
                  if (ticket === generation && p.total)
                    note.textContent = '正在导入 · ' + Math.floor((100 * p.done) / p.total) + '%';
                },
                { addonFor: id },
              ),
            '附加内容已导入',
          ),
        ),
      );
    addon.append(addActions);
    body.append(identity, tools, overlay, addon);
    if (importing) addon.scrollIntoView({ block: 'nearest' });
  }
  async function mapping(id, title) {
    const ticket = begin('按键映射与设置', title?.title || '全局设置');
    const [eff, vocab, base, profiles] = await Promise.all([
      store.effective(id),
      store.vocabulary(),
      id ? store.effective() : store.defaults(),
      listProfiles(),
    ]);
    if (ticket !== generation) return;
    const readonly = isPlaying(),
      draft = new Map();
    const kb = section('键盘与实体手柄');
    kb.append(
      el(
        'p',
        readonly
          ? '本局正在运行，退出游戏后可修改映射。'
          : '点键位后按下新键，Esc 取消。右栏选择对应的手柄按键。',
      ),
    );
    const table = el('div');
    table.className = 'mapping-grid';
    for (const label of ['PS Vita', '键盘', '实体手柄']) table.append(el('strong', label));
    let listening = null;
    function cancel() {
      if (listening) {
        listening.textContent = listening.dataset.code;
        listening = null;
      }
    }
    for (const { name, label } of vocab.buttons) {
      const key = button(eff.keyboard[name] || '—', () => {
        cancel();
        listening = key;
        key.textContent = '请按键…';
      });
      key.dataset.code = key.textContent;
      key.setAttribute('aria-label', (names[name] || label) + '的键盘映射');
      key.disabled = readonly;
      key.onblur = cancel;
      key.onkeydown = (e) => {
        if (listening !== key) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.code !== 'Escape') {
          key.dataset.code = e.code;
          draft.set('keyboard.' + name, e.code);
        }
        cancel();
      };
      const pad = select(
        vocab.gamepadControls.map((c) => [c, padLabels[c] || c.toUpperCase()]),
        eff.gamepad[name],
      );
      pad.disabled = readonly;
      pad.setAttribute('aria-label', (names[name] || label) + '的手柄映射');
      pad.onchange = () => draft.set('gamepad.' + name, pad.value);
      table.append(el('span', names[name] || label), key, pad);
    }
    kb.append(table);
    if (id && !readonly) kb.append(button('编辑全局设置', () => navigate('settings')));
    const config = section('游戏设置');
    function input(path, label, value, type, attrs = {}) {
      const control = el('input');
      control.type = type;
      Object.assign(control, attrs);
      if (type === 'checkbox') control.checked = value;
      else control.value = typeof value === 'number' ? Number(value.toFixed(4)) : value;
      control.disabled = readonly;
      control.oninput = () =>
        draft.set(
          path,
          type === 'checkbox'
            ? control.checked
            : type === 'number'
              ? control.valueAsNumber
              : control.value,
        );
      config.append(field(label, control));
    }
    input('stickDeadzone', '摇杆死区', eff.stickDeadzone, 'number', {
      min: 0,
      max: 0.5,
      step: 0.01,
      required: true,
    });
    input('pad.scale', '屏幕手柄大小', eff.pad.scale, 'number', {
      min: 0.6,
      max: 1.6,
      step: 0.05,
      required: true,
    });
    input('pad.vibrate', '触控振动', eff.pad.vibrate, 'checkbox');
    const profile = el('input');
    profile.value = eff.profile;
    profile.pattern = '(?:[A-Za-z0-9_]|-){1,32}';
    profile.required = true;
    profile.disabled = readonly;
    profile.setAttribute('list', 'pageProfiles');
    const choices = el('datalist');
    choices.id = 'pageProfiles';
    for (const p of profiles) choices.append(new Option(p, p));
    profile.oninput = () => draft.set('profile', profile.value);
    config.append(field('存档配置名', profile), choices);
    const advanced = el('details');
    advanced.append(el('summary', '核心高级设置'));
    const extra = section('运行参数');
    advanced.append(extra);
    for (const [path, label, type] of [
      ['fastForward', '快进至帧', 'number'],
      ['debugCapture', '采集调试计时', 'checkbox'],
      ['consoleNotes', '向控制台输出运行日志', 'checkbox'],
    ]) {
      input(path, label, eff[path], type, type === 'number' ? { min: 0, step: 1, required: true } : {});
      extra.append(config.lastElementChild);
    }
    const knobs = el('textarea');
    knobs.rows = 3;
    knobs.disabled = readonly;
    knobs.value = Object.entries(eff.knobs)
      .map(([k, v]) => k + '=' + v)
      .join('\n');
    knobs.oninput = () => draft.set('knobs', knobs.value);
    knobs.placeholder = '默认多线程，启动时自动选择数量。手动示例：VITASLOP_SMP_WORKERS=3';
    extra.append(field('每行一个 VITASLOP_NAME=value', knobs));
    const form = el('form');
    form.append(kb, config, advanced);
    if (!readonly) {
      const save = el('button', '保存设置');
      save.type = 'submit';
      save.className = 'primary';
      const reset = button('恢复默认映射', async () => {
        const defaults = id ? await store.effective() : await store.defaults();
        if (ticket !== generation) return;
        let i = 0;
        for (const { name } of vocab.buttons) {
          const k = table.querySelectorAll('button')[i],
            s = table.querySelectorAll('select')[i++];
          k.textContent = k.dataset.code = defaults.keyboard[name];
          s.value = defaults.gamepad[name];
          draft.set('keyboard.' + name, k.dataset.code);
          draft.set('gamepad.' + name, s.value);
        }
        note.textContent = '点「保存设置」应用映射';
      });
      const actions = el('div');
      actions.className = 'tools';
      actions.append(save, reset);
      form.append(actions);
      form.onsubmit = async (e) => {
        e.preventDefault();
        try {
          const record = id ? store.titleSettings(id) : store.globalSettings();
          for (const [path, input] of draft) {
            const [group, key] = path.split('.');
            let value = input;
            if (path === 'knobs') value = await store.parseKnobs(input);
            if (key) {
              record[group] = { ...record[group] };
              if (id && value === base[group][key]) delete record[group][key];
              else record[group][key] = value;
            } else if (id && value === base[group]) delete record[group];
            else record[group] = value;
          }
          if (id) store.saveTitleSettings(id, record);
          else store.saveGlobalSettings(record);
          draft.clear();
          note.textContent = '设置已保存';
          notice('设置已保存');
          await refresh();
        } catch (err) {
          note.textContent = err.message;
        }
      };
    }
    body.append(form);
  }
  function missing(id) {
    begin('找不到游戏', id);
    body.append(el('p', '当前游戏库中没有这个编号。'));
  }
  return { close, details, mapping, missing };
}
