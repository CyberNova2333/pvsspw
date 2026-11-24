import * as data from '/gamedata.js';
import { readZip, writeZip } from '/zipstore.js';
import { fmtBytes } from '/store.js';

export function download(name, bytes, type = 'application/zip') {
  const href = URL.createObjectURL(bytes instanceof Blob ? bytes : new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10000);
}
export const saves = data;
export async function exportSaves(id) {
  if (id) {
    const bytes = await data.read(id);
    if (!bytes) throw Error('尚无游戏内存档');
    download('vitaslop-' + id + '-' + data.currentProfile() + '-gamedata.zip', bytes);
    return;
  }
  const entries = [];
  for (const tid of await data.listSaved()) {
    const bytes = await data.read(tid);
    if (!bytes) throw Error('暂时无法读取 ' + tid + ' 的存档，请刷新后重试');
    entries.push({ name: tid + '.zip', bytes });
  }
  if (!entries.length) throw Error('当前配置没有存档');
  download('vitaslop-' + data.currentProfile() + '-all-gamedata.zip', writeZip(entries));
}
function validateSave(bytes) {
  return new Promise((resolve, reject) => {
    const w = new Worker('/gamedata-worker.js', { type: 'module' });
    w.onmessage = ({ data }) => {
      w.terminate();
      data.ok ? resolve(data.summary) : reject(Error(data.error));
    };
    w.onerror = (e) => {
      w.terminate();
      reject(Error(e.message));
    };
    w.postMessage({ zip: bytes.slice().buffer });
  });
}
export async function restoreSaves(file, id) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = id ? [{ name: id + '.zip', bytes }] : readZip(bytes);
  if (!entries.length) throw Error('没有可恢复的游戏存档');
  const seen = new Set(),
    descriptions = [];
  for (const e of entries) {
    if (!/^[A-Za-z0-9_-]+\.zip$/.test(e.name) || seen.has(e.name))
      throw Error('请选择完整备份，或在单个游戏下恢复其存档');
    seen.add(e.name);
    descriptions.push(e.name.slice(0, -4) + ' · ' + (await validateSave(e.bytes)));
  }
  if (
    !confirm(
      '恢复到配置 ' + data.currentProfile() + ' 并覆盖同名游戏的存档？\n' + descriptions.join('\n'),
    )
  )
    return false;
  for (const [index, e] of entries.entries()) {
    try {
      await data.write(e.name.slice(0, -4), e.bytes);
    } catch (error) {
      throw Error(
        '已恢复 ' + index + '/' + entries.length + ' 项，写入 ' + e.name + ' 失败：' + error.message,
      );
    }
  }
  return true;
}
export async function showTree(container, dir, onError) {
  const fragment = document.createDocumentFragment();
  for await (const [name, h] of dir.entries()) {
    if (h.kind === 'directory') {
      const details = document.createElement('details'),
        summary = document.createElement('summary'),
        children = document.createElement('div');
      summary.textContent = name + '/';
      details.append(summary, children);
      details.addEventListener('toggle', () => {
        if (details.open) showTree(children, h, onError).catch(onError);
      });
      fragment.append(details);
    } else {
      const file = await h.getFile(),
        row = document.createElement('div'),
        button = document.createElement('button');
      row.className = 'file-row';
      row.append(name + ' · ' + fmtBytes(file.size));
      button.textContent = '导出';
      button.onclick = () =>
        h
          .getFile()
          .then((f) => download(name, f))
          .catch(onError);
      row.append(button);
      fragment.append(row);
    }
  }
  if (!fragment.childNodes.length) fragment.append('目录为空');
  container.replaceChildren(fragment);
}
