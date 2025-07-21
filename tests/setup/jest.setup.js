// Global test setup
global.console = {
  ...console,
  // Suppress console.log during tests unless needed
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Setup for DOM testing
require("@testing-library/dom");

// Mock canvas for client-side tests (only if HTMLCanvasElement exists)
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn(() => ({ data: new Array(4) })),
    putImageData: jest.fn(),
    createImageData: jest.fn(() => []),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    fillText: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    transform: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
  }));
} else {
  // Create mock HTMLCanvasElement for Node.js environment
  global.HTMLCanvasElement = class HTMLCanvasElement {
    constructor() {
      this.width = 800;
      this.height = 600;
    }

    getContext() {
      return {
        fillRect: jest.fn(),
        clearRect: jest.fn(),
        getImageData: jest.fn(() => ({ data: new Array(4) })),
        putImageData: jest.fn(),
        createImageData: jest.fn(() => []),
        setTransform: jest.fn(),
        drawImage: jest.fn(),
        save: jest.fn(),
        fillText: jest.fn(),
        restore: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        closePath: jest.fn(),
        stroke: jest.fn(),
        translate: jest.fn(),
        scale: jest.fn(),
        rotate: jest.fn(),
        arc: jest.fn(),
        fill: jest.fn(),
        measureText: jest.fn(() => ({ width: 0 })),
        transform: jest.fn(),
        rect: jest.fn(),
        clip: jest.fn(),
      };
    }
  };
}

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 0));
global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));

// Mock DOM APIs not available in Node.js
if (typeof window === "undefined") {
  global.window = {};
}

if (typeof document === "undefined") {
  global.document = {
    createElement: jest.fn(() => ({
      getContext: jest.fn(() => ({
        fillRect: jest.fn(),
        clearRect: jest.fn(),
        drawImage: jest.fn(),
      })),
    })),
    getElementById: jest.fn(() => null),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
}

// Mock performance API
if (typeof performance === "undefined") {
  global.performance = {
    now: jest.fn(() => Date.now()),
  };
}

// Mock Date.now for consistent timing in tests
const mockDateNow = jest.fn(() => 1640995200000); // Fixed timestamp
Date.now = mockDateNow;
