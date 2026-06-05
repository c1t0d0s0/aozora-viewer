/**
 * Generates build/icon.png (512x512) and build/icon.ico (multi-size)
 * with a simple closed-book design matching the app's beige/brown palette.
 */
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");
const pngToIco = require("png-to-ico");

const root = path.join(__dirname, "..");
const outputDir = path.join(root, "build");
const outputPng = path.join(outputDir, "icon.png");
const outputIco = path.join(outputDir, "icon.ico");

const COLORS = {
  bg: [232, 223, 196],
  border: [211, 196, 169],
  spine: [107, 52, 16],
  cover: [139, 69, 19],
  coverLight: [160, 82, 45],
  page: [253, 250, 240],
  pageEdge: [244, 236, 216],
  line: [210, 190, 160],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function blendPixel(data, width, x, y, color, alpha) {
  if (alpha <= 0) return;
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= width || py >= data.length / (width * 4)) return;

  const i = (width * py + px) * 4;
  const srcA = alpha;
  const dstA = data[i + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;

  data[i] = Math.round(lerp(data[i], color[0], srcA / outA));
  data[i + 1] = Math.round(lerp(data[i + 1], color[1], srcA / outA));
  data[i + 2] = Math.round(lerp(data[i + 2], color[2], srcA / outA));
  data[i + 3] = Math.round(outA * 255);
}

function fillRect(data, width, height, x0, y0, x1, y1, color, alpha = 1) {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      blendPixel(data, width, x, y, color, alpha);
    }
  }
}

function roundedRectAlpha(x, y, x0, y0, x1, y1, radius) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return 0;

  const r = Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2);
  const cx = clamp(x, x0 + r, x1 - r);
  const cy = clamp(y, y0 + r, y1 - r);

  if (x >= x0 + r && x <= x1 - r) return 1;
  if (y >= y0 + r && y <= y1 - r) return 1;

  const cornerX = x < x0 + r ? x0 + r : x1 - r;
  const cornerY = y < y0 + r ? y0 + r : y1 - r;
  const dx = x - cornerX;
  const dy = y - cornerY;
  const dist = Math.hypot(dx, dy);

  if (dist <= r - 1) return 1;
  if (dist >= r + 1) return 0;
  return clamp(r + 1 - dist, 0, 1);
}

function fillRoundedRect(data, width, height, x0, y0, x1, y1, radius, color) {
  for (let y = Math.floor(y0 - 1); y <= Math.ceil(y1 + 1); y++) {
    for (let x = Math.floor(x0 - 1); x <= Math.ceil(x1 + 1); x++) {
      const alpha = roundedRectAlpha(x + 0.5, y + 0.5, x0, y0, x1, y1, radius);
      if (alpha > 0) blendPixel(data, width, x, y, color, alpha);
    }
  }
}

function drawIcon(size) {
  const png = new PNG({ width: size, height: size });
  const data = png.data;
  const pad = size * 0.08;
  const radius = size * 0.18;

  fillRoundedRect(data, size, size, pad, pad, size - pad, size - pad, radius, COLORS.bg);
  fillRoundedRect(
    data,
    size,
    size,
    pad + size * 0.015,
    pad + size * 0.015,
    size - pad - size * 0.015,
    size - pad - size * 0.015,
    radius * 0.92,
    COLORS.border
  );
  fillRoundedRect(
    data,
    size,
    size,
    pad + size * 0.03,
    pad + size * 0.03,
    size - pad - size * 0.03,
    size - pad - size * 0.03,
    radius * 0.85,
    COLORS.bg
  );

  const bookX0 = size * 0.2;
  const bookY0 = size * 0.22;
  const bookX1 = size * 0.8;
  const bookY1 = size * 0.78;
  const bookRadius = size * 0.05;
  const spineX = bookX0 + (bookX1 - bookX0) * 0.18;

  fillRoundedRect(
    data,
    size,
    size,
    bookX0,
    bookY0,
    bookX1,
    bookY1,
    bookRadius,
    COLORS.cover
  );
  fillRect(data, size, size, bookX0, bookY0, spineX, bookY1, COLORS.spine);

  const pageInset = size * 0.035;
  fillRoundedRect(
    data,
    size,
    size,
    spineX + pageInset * 0.4,
    bookY0 + pageInset,
    bookX1 - pageInset,
    bookY1 - pageInset,
    bookRadius * 0.7,
    COLORS.page
  );

  const edgeHeight = (bookY1 - bookY0) * 0.08;
  fillRect(
    data,
    size,
    size,
    bookX1 - pageInset * 1.6,
    bookY1 - edgeHeight - pageInset * 0.5,
    bookX1 - pageInset * 0.2,
    bookY1 - pageInset * 0.5,
    COLORS.pageEdge
  );

  const lineLeft = spineX + size * 0.08;
  const lineRight = bookX1 - size * 0.12;
  const lineYs = [0.38, 0.5, 0.62];
  const lineH = Math.max(1, size * 0.012);
  for (const ratio of lineYs) {
    const y = bookY0 + (bookY1 - bookY0) * ratio;
    fillRect(data, size, size, lineLeft, y, lineRight, y + lineH, COLORS.line);
  }

  return PNG.sync.write(png);
}

function resizeNearest(srcBuf, targetSize) {
  const src = PNG.sync.read(srcBuf);
  const dst = new PNG({ width: targetSize, height: targetSize });

  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const sx = Math.min(
        Math.floor(((x + 0.5) * src.width) / targetSize),
        src.width - 1
      );
      const sy = Math.min(
        Math.floor(((y + 0.5) * src.height) / targetSize),
        src.height - 1
      );
      const iSrc = (src.width * sy + sx) * 4;
      const iDst = (targetSize * y + x) * 4;
      dst.data.set(src.data.subarray(iSrc, iSrc + 4), iDst);
    }
  }

  return PNG.sync.write(dst);
}

async function main() {
  const master = drawIcon(512);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPng, master);
  console.log("Wrote", outputPng);

  const icoSizes = [256, 128, 64, 48, 32, 16];
  const pngBuffers = icoSizes.map((s) => resizeNearest(master, s));
  const icoBuf = await pngToIco(pngBuffers);
  fs.writeFileSync(outputIco, icoBuf);
  console.log("Wrote", outputIco);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
