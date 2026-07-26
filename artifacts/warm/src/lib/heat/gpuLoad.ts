// GPU load generator: renders an expensive fragment shader in a loop on a
// small hidden canvas. Intensity scales iteration count and render resolution.

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform float u_time;
uniform float u_iters;
uniform vec2 u_res;
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec3 c = vec3(0.0);
  float x = uv.x * 3.0 - 1.5;
  float y = uv.y * 3.0 - 1.5;
  // Fractal-style iteration: heavy per-pixel math.
  float zx = x, zy = y;
  for (int i = 0; i < 512; i++) {
    if (float(i) >= u_iters) break;
    float nzx = zx * zx - zy * zy + 0.355 + 0.05 * sin(u_time * 0.3);
    zy = 2.0 * zx * zy + 0.355;
    zx = nzx;
    c += 0.002 * vec3(sin(zx + u_time), cos(zy), sin(zx * zy));
  }
  gl_FragColor = vec4(c, 1.0);
}
`;

export class GpuLoad {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private raf = 0;
  private running = false;
  private iters = 128;
  private start = 0;
  private framesPerTick = 1;

  /** intensity in [0,1] */
  begin(intensity: number) {
    this.stop();
    const size = Math.round(64 + intensity * 448); // 64..512 px
    this.iters = Math.round(32 + intensity * 480); // 32..512 iterations
    this.framesPerTick = 1 + Math.round(intensity * 3); // redraws per frame

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.style.cssText =
      'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;pointer-events:none;';
    document.body.appendChild(canvas);
    const gl =
      canvas.getContext('webgl', { powerPreference: 'high-performance' }) ||
      canvas.getContext('experimental-webgl');
    if (!gl) {
      canvas.remove();
      return; // WebGL unavailable — CPU workers still provide load
    }
    const ctx = gl as WebGLRenderingContext;

    const compile = (type: number, src: string) => {
      const s = ctx.createShader(type)!;
      ctx.shaderSource(s, src);
      ctx.compileShader(s);
      return s;
    };
    const program = ctx.createProgram()!;
    ctx.attachShader(program, compile(ctx.VERTEX_SHADER, VERT));
    ctx.attachShader(program, compile(ctx.FRAGMENT_SHADER, FRAG));
    ctx.linkProgram(program);
    ctx.useProgram(program);

    const buf = ctx.createBuffer();
    ctx.bindBuffer(ctx.ARRAY_BUFFER, buf);
    ctx.bufferData(
      ctx.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      ctx.STATIC_DRAW,
    );
    const loc = ctx.getAttribLocation(program, 'a_pos');
    ctx.enableVertexAttribArray(loc);
    ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);
    ctx.viewport(0, 0, size, size);

    this.canvas = canvas;
    this.gl = ctx;
    this.program = program;
    this.running = true;
    this.start = performance.now();
    this.tick();
  }

  private tick = () => {
    if (!this.running || !this.gl || !this.program) return;
    const gl = this.gl;
    const t = (performance.now() - this.start) / 1000;
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_time'), t);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_iters'), this.iters);
    gl.uniform2f(
      gl.getUniformLocation(this.program, 'u_res'),
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
    );
    for (let i = 0; i < this.framesPerTick; i++) {
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // Force the GPU to actually finish the work each frame.
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    this.raf = requestAnimationFrame(this.tick);
  };

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.gl) {
      const ext = this.gl.getExtension('WEBGL_lose_context');
      ext?.loseContext();
    }
    this.canvas?.remove();
    this.canvas = null;
    this.gl = null;
    this.program = null;
  }
}
