// gen-icons.mjs — generate the PWA / native icon set with Node built-ins only.
//
// Emits valid solid-color PNGs (PNG color type 2, 8-bit RGB) using zlib deflate.
// Each scanline is prefixed with a single 0 filter byte. No third-party deps.
//
// Run from the repo root:   node app/scripts/gen-icons.mjs
// or from inside app/:      node scripts/gen-icons.mjs
//
// Outputs (relative to app/):
//   public/icon-192.png            192  brand  #4f46e5
//   public/icon-512.png            512  brand  #4f46e5
//   public/apple-touch-icon.png    180  brand  #4f46e5
//   assets/icon.png               1024  brand  #4f46e5
//   assets/adaptive-icon.png      1024  brand  #4f46e5
//   assets/splash.png             1284  dark   #0b1020
//   assets/favicon.png              48  brand  #4f46e5

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function crc32(buf){let c=~0;for(let i=0;i<buf.length;i++){c^=buf[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&(-(c&1)));}return (~c)>>>0;}
function chunk(type,data){const t=Buffer.from(type,'ascii');const len=Buffer.alloc(4);len.writeUInt32BE(data.length,0);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([t,data])),0);return Buffer.concat([len,t,data,crc]);}
function png(size,r,g,b){const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=2;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;const row=Buffer.alloc(1+size*3);for(let x=0;x<size;x++){row[1+x*3]=r;row[2+x*3]=g;row[3+x*3]=b;}const raw=Buffer.concat(Array.from({length:size},()=>Buffer.from(row)));const idat=deflateSync(raw,{level:9});const sig=Buffer.from([137,80,78,71,13,10,26,10]);return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',idat),chunk('IEND',Buffer.alloc(0))]);}

// Resolve paths relative to the app/ root regardless of the cwd the script
// was launched from (scripts/ lives directly under app/).
const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..');

// Brand indigo (#4f46e5) and the dark splash background (#0b1020).
const BRAND = [0x4f, 0x46, 0xe5];
const DARK = [0x0b, 0x10, 0x20];

const targets = [
  { path: 'public/icon-192.png', size: 192, color: BRAND },
  { path: 'public/icon-512.png', size: 512, color: BRAND },
  { path: 'public/apple-touch-icon.png', size: 180, color: BRAND },
  { path: 'assets/icon.png', size: 1024, color: BRAND },
  { path: 'assets/adaptive-icon.png', size: 1024, color: BRAND },
  { path: 'assets/splash.png', size: 1284, color: DARK },
  { path: 'assets/favicon.png', size: 48, color: BRAND },
];

const madeDirs = new Set();
for (const { path, size, color } of targets) {
  const abs = resolve(appRoot, path);
  const dir = dirname(abs);
  if (!madeDirs.has(dir)) {
    mkdirSync(dir, { recursive: true });
    madeDirs.add(dir);
  }
  const buf = png(size, color[0], color[1], color[2]);
  writeFileSync(abs, buf);
  console.log(`wrote ${path} (${size}x${size}, ${buf.length} bytes)`);
}

console.log(`Done: ${targets.length} PNG(s) written.`);
