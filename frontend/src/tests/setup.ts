import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Complete WebGL / WebGL2 mock for Three.js in jsdom
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextType: string) {
    if (
      contextType === 'webgl' ||
      contextType === 'webgl2' ||
      contextType === 'experimental-webgl'
    ) {
      const mockContext: Record<string, any> = {
        canvas: this,
        getContextAttributes: vi.fn().mockReturnValue({
          alpha: true,
          antialias: true,
          depth: true,
          stencil: true,
          premultipliedAlpha: true,
          preserveDrawingBuffer: false,
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: false,
        }),
        isContextLost: vi.fn().mockReturnValue(false),
        // WebGL Constants
        VERSION: 0x1f02,
        SHADING_LANGUAGE_VERSION: 0x8b8c,
        VENDOR: 0x1f00,
        RENDERER: 0x1f01,
        MAX_TEXTURE_SIZE: 0x0d33,
        MAX_CUBE_MAP_TEXTURE_SIZE: 0x851c,
        MAX_RENDERBUFFER_SIZE: 0x84e8,
        MAX_VERTEX_TEXTURE_IMAGE_UNITS: 0x8b4c,
        MAX_TEXTURE_IMAGE_UNITS: 0x8872,
        MAX_COMBINED_TEXTURE_IMAGE_UNITS: 0x8b4d,
        MAX_VERTEX_ATTRIBS: 0x8869,
        MAX_VARYING_VECTORS: 0x8dfc,
        MAX_VERTEX_UNIFORM_VECTORS: 0x8dfb,
        MAX_FRAGMENT_UNIFORM_VECTORS: 0x8dfd,
        MAX_SAMPLES: 0x8d57,
        VERTEX_SHADER: 0x8b31,
        FRAGMENT_SHADER: 0x8b30,
        HIGH_FLOAT: 0x8dfa,
        MEDIUM_FLOAT: 0x8df9,
        LOW_FLOAT: 0x8df8,
        HIGH_INT: 0x8df5,
        MEDIUM_INT: 0x8df4,
        LOW_INT: 0x8df3,
        FRAMEBUFFER_COMPLETE: 0x8cd5,

        getExtension: vi.fn().mockImplementation((name: string) => {
          if (name === 'WEBGL_depth_texture') return {};
          if (name === 'OES_texture_float') return {};
          if (name === 'OES_texture_half_float') return {};
          return {};
        }),
        getParameter: vi.fn().mockImplementation((param: number | undefined) => {
          // VERSION
          if (param === 0x1f02 || param === undefined) return 'WebGL 2.0 (OpenGL ES 3.0 Chromium)';
          // SHADING_LANGUAGE_VERSION
          if (param === 0x8b8c) return 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)';
          // VENDOR
          if (param === 0x1f00) return 'WebKit';
          // RENDERER
          if (param === 0x1f01) return 'WebKit WebGL';
          // MAX_TEXTURE_SIZE
          if (param === 0x0d33) return 4096;
          // MAX_CUBE_MAP_TEXTURE_SIZE
          if (param === 0x851c) return 4096;
          // MAX_RENDERBUFFER_SIZE
          if (param === 0x84e8) return 4096;
          // MAX_VERTEX_TEXTURE_IMAGE_UNITS
          if (param === 0x8b4c) return 16;
          // MAX_TEXTURE_IMAGE_UNITS
          if (param === 0x8872) return 16;
          // MAX_COMBINED_TEXTURE_IMAGE_UNITS
          if (param === 0x8b4d) return 32;
          // MAX_VERTEX_ATTRIBS
          if (param === 0x8869) return 16;
          // MAX_VARYING_VECTORS
          if (param === 0x8dfc) return 16;
          // MAX_VERTEX_UNIFORM_VECTORS
          if (param === 0x8dfb) return 1024;
          // MAX_FRAGMENT_UNIFORM_VECTORS
          if (param === 0x8dfd) return 1024;
          // MAX_SAMPLES
          if (param === 0x8d57) return 4;
          return 4096;
        }),
        getShaderPrecisionFormat: vi.fn().mockReturnValue({
          rangeMin: 127,
          rangeMax: 127,
          precision: 23,
        }),
        createShader: vi.fn().mockReturnValue({}),
        shaderSource: vi.fn(),
        compileShader: vi.fn(),
        getShaderParameter: vi.fn().mockReturnValue(true),
        getShaderInfoLog: vi.fn().mockReturnValue(''),
        createProgram: vi.fn().mockReturnValue({}),
        attachShader: vi.fn(),
        linkProgram: vi.fn(),
        getProgramParameter: vi.fn().mockReturnValue(true),
        getProgramInfoLog: vi.fn().mockReturnValue(''),
        useProgram: vi.fn(),
        createBuffer: vi.fn().mockReturnValue({}),
        bindBuffer: vi.fn(),
        bufferData: vi.fn(),
        bufferSubData: vi.fn(),
        enable: vi.fn(),
        disable: vi.fn(),
        clear: vi.fn(),
        clearColor: vi.fn(),
        clearDepth: vi.fn(),
        clearStencil: vi.fn(),
        viewport: vi.fn(),
        scissor: vi.fn(),
        drawArrays: vi.fn(),
        drawElements: vi.fn(),
        getUniformLocation: vi.fn().mockReturnValue({}),
        getAttribLocation: vi.fn().mockReturnValue(0),
        enableVertexAttribArray: vi.fn(),
        disableVertexAttribArray: vi.fn(),
        vertexAttribPointer: vi.fn(),
        uniform1f: vi.fn(),
        uniform1i: vi.fn(),
        uniform2f: vi.fn(),
        uniform2i: vi.fn(),
        uniform3f: vi.fn(),
        uniform3i: vi.fn(),
        uniform4f: vi.fn(),
        uniform4i: vi.fn(),
        uniform1fv: vi.fn(),
        uniform2fv: vi.fn(),
        uniform3fv: vi.fn(),
        uniform4fv: vi.fn(),
        uniformMatrix3fv: vi.fn(),
        uniformMatrix4fv: vi.fn(),
        createTexture: vi.fn().mockReturnValue({}),
        bindTexture: vi.fn(),
        texParameteri: vi.fn(),
        texParameterf: vi.fn(),
        texImage2D: vi.fn(),
        texSubImage2D: vi.fn(),
        texImage3D: vi.fn(),
        texSubImage3D: vi.fn(),
        texStorage2D: vi.fn(),
        texStorage3D: vi.fn(),
        createVertexArray: vi.fn().mockReturnValue({}),
        bindVertexArray: vi.fn(),
        deleteVertexArray: vi.fn(),
        generateMipmap: vi.fn(),
        depthFunc: vi.fn(),
        depthMask: vi.fn(),
        depthRange: vi.fn(),
        cullFace: vi.fn(),
        frontFace: vi.fn(),
        blendFunc: vi.fn(),
        blendFuncSeparate: vi.fn(),
        blendEquation: vi.fn(),
        blendEquationSeparate: vi.fn(),
        colorMask: vi.fn(),
        stencilFunc: vi.fn(),
        stencilMask: vi.fn(),
        stencilOp: vi.fn(),
        pixelStorei: vi.fn(),
        deleteShader: vi.fn(),
        deleteProgram: vi.fn(),
        deleteBuffer: vi.fn(),
        deleteTexture: vi.fn(),
        createFramebuffer: vi.fn().mockReturnValue({}),
        bindFramebuffer: vi.fn(),
        framebufferTexture2D: vi.fn(),
        deleteFramebuffer: vi.fn(),
        createRenderbuffer: vi.fn().mockReturnValue({}),
        bindRenderbuffer: vi.fn(),
        renderbufferStorage: vi.fn(),
        framebufferRenderbuffer: vi.fn(),
        deleteRenderbuffer: vi.fn(),
        checkFramebufferStatus: vi.fn().mockReturnValue(0x8cd5),
      };
      return mockContext as unknown as RenderingContext;
    }
    return null;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

// Mock requestAnimationFrame / cancelAnimationFrame
if (typeof window !== 'undefined') {
  window.requestAnimationFrame = window.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
  window.cancelAnimationFrame = window.cancelAnimationFrame || ((id) => clearTimeout(id));
}
