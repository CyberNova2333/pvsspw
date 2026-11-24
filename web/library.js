import * as store from '/store.js';
import * as ingest from '/import.js';
import { readRepatch, removeTitle } from '/opfs.js';

export { readRepatch };
export async function install(entries, onProgress) {
  if (!entries.length) throw Error('请选择游戏文件');
  const done = await ingest.run(
    entries,
    (p) => onProgress(p.title || '识别游戏'),
    (p) => {
      const fraction = p.total > 0 ? Math.min(1, p.done / p.total) : null;
      onProgress(fraction === null ? '正在读取游戏' : '正在导入游戏', fraction);
    },
  );
  const p = done.probe || {},
    id = done.titleId;
  const old = await store.readTitle(id);
  const meta = {
    titleId: id,
    title: p.title || id,
    contentId: done.contentId || p.contentId || '',
    appVersion: p.appVersion || '',
    sourceKind: p.kind || '',
    bytes: p.bytes || entries.reduce((n, e) => n + e.file.size, 0),
    files: done.count,
    hasIcon: !!p.icon0,
    hasPic: !!p.pic0,
    importedAt: Date.now(),
    lastPlayedAt: old?.lastPlayedAt || 0,
  };
  await store.writeTitle(meta, { 'icon0.png': p.icon0, 'pic0.png': p.pic0 });
  return meta;
}
export async function patch(title, file) {
  await ingest.runRepatch([{ path: file.name, file }], title.titleId, { source: file.name });
}
export async function removeGame(title) {
  await removeTitle(title.titleId);
  await store.removeTitleRecord(title.titleId);
}
