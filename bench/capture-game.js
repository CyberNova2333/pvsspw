// Read the game texture before the compositor recycles it. Hardware playback
// uses the native canvas; software adapters can present it on a CPU canvas.
const readbackQuery = new URL(self.location.href).searchParams;
const softwarePresent = readbackQuery.get('uiPresent') === 'software';
if ((softwarePresent || readbackQuery.has('captureGame')) && globalThis.GPUCanvasContext) {
  const devices = new WeakMap();
  const context = GPUCanvasContext.prototype;
  const configure = context.configure;
  context.configure = function (descriptor) {
    const usage = descriptor.usage ?? GPUTextureUsage.RENDER_ATTACHMENT;
    const result = configure.call(this, {...descriptor, usage: usage | GPUTextureUsage.COPY_SRC});
    devices.set(this, descriptor.device);
    return result;
  };
  const owners = new WeakMap();
  const acquire = context.getCurrentTexture;
  context.getCurrentTexture = function () {
    const texture = acquire.call(this);
    owners.set(texture, devices.get(this));
    return texture;
  };
  let frames = 0, busy = false, awaitingDisplay = false, last = 0, reportedError = false;
  if (softwarePresent) self.addEventListener('message', event => {
    if (event.data?.type !== 'pvsspw-presented') return;
    event.stopImmediatePropagation();
    awaitingDisplay = false;
  });
  self.pvCaptureTexture = async texture => {
    const frame = ++frames;
    const time = performance.timeOrigin + performance.now();
    if (busy || awaitingDisplay || (frame > 1 && time - last < (softwarePresent ? 1000 / 30 : 700))) return;
    busy = true;
    last = time;
    let buffer;
    try {
      const device = owners.get(texture);
      const {width, height, format} = texture;
      if (!/^(bgra|rgba)8unorm(-srgb)?$/.test(format)) throw Error('Unsupported readback format: '+format);
      const bytesPerRow = Math.ceil(width * 4 / 256) * 256;
      buffer = device.createBuffer({size: bytesPerRow * height, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST});
      const encoder = device.createCommandEncoder();
      encoder.copyTextureToBuffer({texture}, {buffer, bytesPerRow}, {width, height});
      device.queue.submit([encoder.finish()]);
      await buffer.mapAsync(GPUMapMode.READ);
      const source = new Uint8Array(buffer.getMappedRange());
      const rgba = new Uint8ClampedArray(width * height * 4);
      for (let row = 0; row < height; row++)
        rgba.set(source.subarray(row * bytesPerRow, row * bytesPerRow + width * 4), row * width * 4);
      if (format.startsWith('bgra')) {
        for (let i = 0; i < rgba.length; i += 4) {
          const blue = rgba[i]; rgba[i] = rgba[i+2]; rgba[i+2] = blue;
        }
      }
      if (softwarePresent) {
        for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
        self.postMessage({type:'pvsspw-software-frame', width, height, rgba}, [rgba.buffer]);
        awaitingDisplay = true;
        return;
      }
      const surface = new OffscreenCanvas(width, height);
      surface.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0);
      const blob = await surface.convertToBlob({type:'image/png'});
      self.postMessage({type:'pvsspw-capture', frame, time, blob});
    } catch (error) {
      if (!softwarePresent || !reportedError) self.postMessage({type:'pvsspw-capture-error', message:String(error)});
      reportedError = true;
    } finally {
      buffer?.destroy();
      busy = false;
    }
  };
}
