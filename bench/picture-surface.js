// Installed only by the bench when it explicitly requests a picture-rate trial.
self.battleDevices = new WeakMap();
{
  const proto = GPUCanvasContext.prototype;
  const configure = proto.configure, acquire = proto.getCurrentTexture;
  const devices = new WeakMap();
  proto.configure = function (options) {
    const usage = options.usage ?? GPUTextureUsage.RENDER_ATTACHMENT;
    configure.call(this, {...options, usage: usage | GPUTextureUsage.TEXTURE_BINDING});
    devices.set(this, options.device);
  };
  proto.getCurrentTexture = function () {
    const texture = acquire.call(this);
    self.battleDevices.set(texture, devices.get(this));
    return texture;
  };
}
