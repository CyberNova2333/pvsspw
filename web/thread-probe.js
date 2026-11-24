// Count equal batches of dependent integer operations and memory reads until a
// common wall-clock deadline. Each worker has its own small working set.
const words = new Uint32Array(16384);
let state = 1;
function advance() {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state;
}
for (let i = 0; i < words.length; i++) words[i] = advance();
self.onmessage = ({ data }) => {
  const end = data ? data - performance.timeOrigin : performance.now() + 12;
  let batches = 0;
  while (performance.now() < end) {
    for (let i = 0; i < 256; i++) {
      const index = advance() >>> 18;
      state ^= words[index];
    }
    batches++;
  }
  self.postMessage(batches);
};
