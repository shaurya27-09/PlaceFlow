const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Ensure public directory exists
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// CRC32 implementation for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(len + 12);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, len + 8);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, len + 8);
  return chunk;
}

function createPng(width, height, getPixelRGBA) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type 6: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw image data with scanline filter byte 0x00
  const rowBytes = width * 4;
  const rawData = Buffer.alloc(height * (rowBytes + 1));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixelRGBA(x, y, width, height);
      rawData[offset++] = Math.max(0, Math.min(255, Math.round(r)));
      rawData[offset++] = Math.max(0, Math.min(255, Math.round(g)));
      rawData[offset++] = Math.max(0, Math.min(255, Math.round(b)));
      rawData[offset++] = Math.max(0, Math.min(255, Math.round(a)));
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

// Distance to rounded rectangle
function sdRoundRect(px, py, rx, ry, rw, rh, radius) {
  const dx = Math.max(Math.abs(px - (rx + rw / 2)) - rw / 2 + radius, 0);
  const dy = Math.max(Math.abs(py - (ry + rh / 2)) - rh / 2 + radius, 0);
  return Math.sqrt(dx * dx + dy * dy) - radius;
}

// Draw PlaceFlow icon pixel: Deep vibrant blue gradient background with sharp white "P" monogram and placement graduation arrow
function renderPlaceFlowIcon(x, y, width, height, isMaskable = false) {
  const u = x / width;
  const v = y / height;

  // Background gradient: from #1e3a8a (top-left) to #2563eb / #1d4ed8 (bottom-right)
  const bgR = 30 + (37 - 30) * (u * 0.5 + v * 0.5);
  const bgG = 58 + (99 - 58) * (u * 0.5 + v * 0.5);
  const bgB = 138 + (235 - 138) * (u * 0.5 + v * 0.5);

  if (!isMaskable) {
    // Rounded squircle border on transparent canvas
    const cornerRadius = width * 0.22;
    const d = sdRoundRect(x, y, 0, 0, width, height, cornerRadius);
    if (d > 0) {
      return [0, 0, 0, 0]; // Transparent outside
    }
  }

  // Normalized coordinates centered at (0, 0)
  const cx = width / 2;
  const cy = height / 2;
  const scale = isMaskable ? 0.65 : 0.82; // 15-20% safe zone for maskable icon
  const nx = (x - cx) / (width * 0.5 * scale);
  const ny = (y - cy) / (height * 0.5 * scale);

  // Logo features:
  // 1. Vertical stem of P: x from -0.6 to -0.32, y from -0.65 to 0.65
  const inStem = (nx >= -0.58 && nx <= -0.30 && ny >= -0.62 && ny <= 0.62);

  // 2. Upper loop of P:
  // Outer circle centered around (-0.30, -0.15) with radius ~0.48
  // Cut out inner circle with radius ~0.22
  const loopCenterX = -0.30;
  const loopCenterY = -0.15;
  const distToLoop = Math.sqrt((nx - loopCenterX) ** 2 + (ny - loopCenterY) ** 2);
  const inOuterLoop = distToLoop <= 0.47 && nx >= loopCenterX - 0.05 && ny >= -0.62 && ny <= 0.32;
  const inInnerHole = distToLoop < 0.21 && nx >= loopCenterX;
  const inLoop = inOuterLoop && !inInnerHole;

  // 3. Upward Graduation / Placement Arrow node (accent in cyan #38bdf8 to white)
  // Arrow pointing up-right from (0.05, 0.05) to (0.55, -0.45)
  // Arrow shaft:
  const ax1 = 0.0;
  const ay1 = 0.30;
  const ax2 = 0.50;
  const ay2 = -0.20;
  // Line segment distance
  const ldx = ax2 - ax1;
  const ldy = ay2 - ay1;
  const lineLenSq = ldx * ldx + ldy * ldy;
  const t = Math.max(0, Math.min(1, ((nx - ax1) * ldx + (ny - ay1) * ldy) / lineLenSq));
  const projX = ax1 + t * ldx;
  const projY = ay1 + t * ldy;
  const distToShaft = Math.sqrt((nx - projX) ** 2 + (ny - projY) ** 2);
  const inShaft = distToShaft <= 0.10 && t >= 0 && t <= 1;

  // Arrowhead: triangle at tip (0.50, -0.20)
  const inArrowHead1 = (nx >= 0.28 && nx <= 0.54 && ny >= -0.38 && ny <= -0.20) && (Math.abs(ny - -0.20) <= 0.12);
  const inArrowHead2 = (nx >= 0.40 && nx <= 0.54 && ny >= -0.38 && ny <= -0.05);
  const inArrowTip = (inArrowHead1 || inArrowHead2);

  // Digital placement node circles:
  const distToNode1 = Math.sqrt((nx - 0.52) ** 2 + (ny - -0.22) ** 2);
  const inNode1 = distToNode1 <= 0.13;

  const distToNode2 = Math.sqrt((nx - -0.02) ** 2 + (ny - 0.32) ** 2);
  const inNode2 = distToNode2 <= 0.11;

  if (inNode1) {
    // Glowing cyan/white node
    return [56, 189, 248, 255]; // Sky blue
  }

  if (inNode2) {
    return [96, 165, 250, 255]; // Blue 400
  }

  if (inShaft || inArrowTip) {
    // Dynamic Placement Flow Arrow in crisp cyan/white
    return [240, 249, 255, 255];
  }

  if (inStem || inLoop) {
    // Monogram P in crisp white
    return [255, 255, 255, 255];
  }

  // Subtle decorative geometric background dots/grid
  const gridX = Math.abs((x % (width * 0.12)) - (width * 0.06));
  const gridY = Math.abs((y % (height * 0.12)) - (height * 0.06));
  if (gridX * gridX + gridY * gridY < (width * 0.008) ** 2) {
    return [bgR + 25, bgG + 30, bgB + 20, 255];
  }

  return [bgR, bgG, bgB, 255];
}

console.log('Generating PWA icons in /public...');

// 1. 192x192 PNG
const png192 = createPng(192, 192, (x, y, w, h) => renderPlaceFlowIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);
console.log('✓ Created public/pwa-192x192.png (192x192)');

// 2. 512x512 PNG
const png512 = createPng(512, 512, (x, y, w, h) => renderPlaceFlowIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);
console.log('✓ Created public/pwa-512x512.png (512x512)');

// 3. 512x512 Maskable PNG (full bleed background, padded logo)
const pngMaskable512 = createPng(512, 512, (x, y, w, h) => renderPlaceFlowIcon(x, y, w, h, true));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pngMaskable512);
console.log('✓ Created public/pwa-maskable-512x512.png (512x512 Maskable)');

// 4. 180x180 Apple Touch Icon
const pngApple180 = createPng(180, 180, (x, y, w, h) => renderPlaceFlowIcon(x, y, w, h, true)); // iOS clips to squircle, so full bleed is best
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), pngApple180);
console.log('✓ Created public/apple-touch-icon.png (180x180)');

// 5. Favicon 48x48 PNG (named favicon.ico or favicon.png)
const pngFavicon = createPng(48, 48, (x, y, w, h) => renderPlaceFlowIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), pngFavicon);
fs.writeFileSync(path.join(publicDir, 'favicon.png'), pngFavicon);
console.log('✓ Created public/favicon.ico and favicon.png');

// 6. SVG Icon for high-res vector displays
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="50%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="arrowGlow" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.3"/>
    </filter>
  </defs>
  <!-- Rounded Squircle Base -->
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  
  <!-- Subtle Grid Accent -->
  <circle cx="128" cy="128" r="4" fill="#ffffff" fill-opacity="0.15"/>
  <circle cx="384" cy="128" r="4" fill="#ffffff" fill-opacity="0.15"/>
  <circle cx="128" cy="384" r="4" fill="#ffffff" fill-opacity="0.15"/>
  <circle cx="384" cy="384" r="4" fill="#ffffff" fill-opacity="0.15"/>

  <!-- Monogram P & Placement Flow Symbol -->
  <g filter="url(#shadow)">
    <!-- Vertical stem of P -->
    <rect x="136" y="128" width="60" height="256" rx="16" fill="#ffffff"/>
    
    <!-- Top loop of P -->
    <path d="M 170 128 H 280 C 335 128 375 168 375 220 C 375 272 335 312 280 312 H 170 Z" fill="#ffffff"/>
    <!-- Loop inner cut -->
    <path d="M 196 176 H 272 C 298 176 320 196 320 220 C 320 244 298 264 272 264 H 196 Z" fill="url(#bg)"/>

    <!-- Upward Placement Arrow -->
    <path d="M 256 340 L 376 220" stroke="url(#arrowGlow)" stroke-width="28" stroke-linecap="round"/>
    <!-- Arrow Head -->
    <path d="M 316 212 H 384 V 280" stroke="url(#arrowGlow)" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
    
    <!-- Pulse Nodes -->
    <circle cx="380" cy="216" r="22" fill="#38bdf8"/>
    <circle cx="380" cy="216" r="12" fill="#ffffff"/>
    <circle cx="256" cy="340" r="16" fill="#60a5fa"/>
  </g>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);
console.log('✓ Created public/icon.svg');

console.log('All PWA assets created successfully!');
