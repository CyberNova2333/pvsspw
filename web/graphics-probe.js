import { findGraphics } from './graphics.js';
self.onmessage = async ({ data }) => self.postMessage(await findGraphics(navigator.gpu, data));
