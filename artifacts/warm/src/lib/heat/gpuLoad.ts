// GPU load generator: renders an expensive fragment shader in a loop on a
// hidden canvas. At HIGH intensity, three canvases run simultaneously.

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
  float zx = x, zy = y;
  // Cap raised to 2048 — doubles shader ALU work per frame at HIGH.
  for (int i = 0; i < 2048; i++) {
    if (float(i) >= u_iters) break;
    float nzx = zx * zx - zy * zy + 0.355 + 0.05 * sin(u_time * 0.3);
    float nzy = 2.0 * zx * zy + 0.355;
    // Extra ALU work per iteration: nested trig to saturate shader cores.
    float heat = sin(zx * 1.7 + u_time) * cos(nzy * 1.3 - u_time * 0.7);
    zx = nzx + heat * 0.001;
    zy = nzy;
    c += 0.0015 * vec3(sin(zx + u_time), cos(zy), sin(zx * zy + heat));
  }
  gl_FragColor = vec4(c, 1.0);
}
`;

interface GLContext {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  raf: number;
}

export class GpuLoad {
  private contexts: GLContext[] = [];
  private running = false;
  private iters = 128;
  private framesPerTick = 1;
  private start = 0;

  /** intensity in [0,1] */
  begin(intensity: number) {
    this.stop();

    // HIGH: 3 canvases; MEDIUM: 2; LOW: 1.
    const canvasCount = intensity >= 1 ? 3 : intensity >= 0.5 ? 2 : 1;
    const size = Math.round(128 + intensity * 896); // 128..1024 px
    this.iters = Math.round(64 + intensity * 1984); // 64..2048 iterations
    this.framesPerTick = 1 + Math.round(intensity * 5); // 1..6 redraws/frame
    this.start = performance.now();
    this.running = true;

    for (let c = 0; c < canvasCount; c++) {
      const ctx = this._buildContext(size);
      if (ctx) {
        this.contexts.push(ctx);
        this._tick(ctx);
      }
    }
  }

  private _buildContext(size: number): GLContext | null {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    // Keep canvas in the visible viewport (opacity near-zero) so Android WebView
    // does NOT throttle requestAnimationFrame for off-screen content.
    canvas.style.cssText =
      'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0.001;pointer-events:none;z-index:-1;';
    document.body.appendChild(canvas);

    const gl =
      (canvas.getContext('webgl', { powerPreference: 'high-performance' }) ||
       canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

    if (!gl) { canvas.remove(); return null; }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, size, size);

    return { canvas, gl, program, raf: 0 };
  }

  private _tick = (ctx: GLContext) => {
    if (!this.running) return;
    const { gl, program } = ctx;
    const t = (performance.now() - this.start) / 1000;
    gl.uniform1f(gl.getUniformLocation(program, 'u_time'), t);
    gl.uniform1f(gl.getUniformLocation(program, 'u_iters'), this.iters);
    gl.uniform2f(gl.getUniformLocation(program, 'u_res'), gl.drawingBufferWidth, gl.drawingBufferHeight);
    for (let i = 0; i < this.framesPerTick; i++) {
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // Force the GPU to finish — prevents driver batching that would let it "rest".
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    ctx.raf = requestAnimationFrame(() => this._tick(ctx));
  };

  stop() {
    this.running = false;
    for (const ctx of this.contexts) {
      if (ctx.raf) cancelAnimationFrame(ctx.raf);
      try {
        const ext = ctx.gl.getExtension('WEBGL_lose_context');
        ext?.loseContext();
      } catch { /* ignore */ }
      ctx.canvas.remove();
    }
    this.contexts = [];
  }
}
