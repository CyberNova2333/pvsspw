// The core allocates its shared scheduler and binds Vita threads at boot.
// Choose the guest pool before the run and transpile workers receive their knobs.
export function guestWorkerLimit(cores, memoryGiB) {
  // Leave room for the presenter and browser. Six guest workers can give each
  // of the Vita's three application cores two workers with matching affinity.
  const cpu = Number.isInteger(cores) && cores > 0 ? cores - 2 : 3;
  const memory = memoryGiB > 0 && memoryGiB <= 2 ? 2 : memoryGiB > 0 && memoryGiB <= 4 ? 4 : 6;
  return Math.max(2, Math.min(cpu, memory));
}

export function selectWorkerCount(scores) {
  // Prefer the smallest pool within 10% of the best sustained throughput.
  const threshold = Math.max(...scores.values()) * 0.9;
  for (const [count, score] of scores) if (score >= threshold) return count;
  throw Error('No usable parallel throughput measurement');
}

async function measureParallelism(limit) {
  const workers = [];
  let timer;
  function sample(worker, until) {
    return new Promise((resolve, reject) => {
      worker.onmessage = e => resolve(e.data);
      worker.onerror = () => reject(Error('CPU probe worker failed'));
      worker.postMessage(until);
    });
  }
  async function run() {
    for (let i = 0; i < limit; i++) workers.push(new Worker(new URL('./thread-probe.js', import.meta.url)));
    // Initialise and warm every worker before measuring any pool size.
    await Promise.all(workers.map(w => sample(w, 0)));
    const counts = workers.map((_, i) => i + 1).slice(1);
    const scores = new Map(counts.map(n => [n, Infinity]));
    for (const n of [...counts, ...counts.slice().reverse()]) {
      const start = performance.now();
      const deadline = performance.timeOrigin + start + 32;
      const samples = await Promise.all(workers.slice(0, n).map(w => sample(w, deadline)));
      const score = samples.reduce((a, b) => a + b, 0) / (performance.now() - start);
      if (!Number.isFinite(score) || score <= 0) throw Error('CPU probe interrupted');
      scores.set(n, Math.min(scores.get(n), score));
    }
    return selectWorkerCount(scores);
  }
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error('CPU probe timed out')), 1200);
    });
    return await Promise.race([run(), timeout]);
  } finally {
    clearTimeout(timer);
    for (const w of workers) w.terminate();
  }
}

export async function chooseThreadPolicy(knobs, device, { titleId, adapter, measure = measureParallelism } = {}) {
  if (String(knobs.VITASLOP_SMP ?? '1') !== '1') return { mode: 'single' };
  const specified = String(knobs.VITASLOP_SMP_WORKERS ?? '').trim();
  if (/^\+?0*[1-8]$/.test(specified)) return { mode: 'manual', workers: Number(specified) };
  const limit = guestWorkerLimit(device.hardwareConcurrency, device.deviceMemory);
  // Same game and host configuration as results/runs/edge-thread-policy.json.
  // The six-worker CPU-probe choice lost to the three-worker pool in the game.
  if (titleId === 'PCSG00214' && device.platform === 'Linux x86_64' && /Edg\/157\./.test(device.userAgent) &&
      device.hardwareConcurrency === 24 && device.deviceMemory === 32 && adapter?.vendor === 'intel' &&
      adapter.architecture === 'xe-lpg' && adapter.mode === 'core' && !adapter.software) {
    return { mode: 'game', workers: 3 };
  }
  if (limit === 2) return { mode: 'budget', workers: 2 };
  try {
    return { mode: 'measured', workers: await measure(limit) };
  } catch {
    return { mode: 'budget', workers: Math.min(3, limit) };
  }
}
