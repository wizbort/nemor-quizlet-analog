// Post-export PWA injection.
//
// Expo Router's `output: "single"` (SPA) emits a fixed default index.html and
// does NOT apply app/+html.tsx (that file is only used in `static`/`server`
// output). So after `expo export -p web` we patch dist/index.html to add the
// web-app manifest, iOS home-screen meta, theme color, and the service-worker
// registration. The single index.html is what the Worker serves as the SPA
// shell for every route, so injecting here covers the whole app.
//
// Idempotent: re-running on an already-patched file is a no-op.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const indexPath = resolve(here, '..', 'dist', 'index.html');

if (!existsSync(indexPath)) {
  console.error('[inject-pwa] dist/index.html not found — run `expo export -p web` first.');
  process.exit(1);
}

let html = readFileSync(indexPath, 'utf8');

const MARKER = '<!-- pwa-injected -->';
if (html.includes(MARKER)) {
  console.log('[inject-pwa] already injected — skipping.');
  process.exit(0);
}

// 1) Localize the document language.
html = html.replace('<html lang="en">', '<html lang="ru">');

// 2) Standalone-friendly viewport (cover the notch, lock zoom in-app).
html = html.replace(
  /<meta name="viewport"[^>]*\/>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />',
);

// 3) PWA head block + service-worker registration, inserted before </head>.
const head = `  ${MARKER}
    <meta name="theme-color" content="#0b1020" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Карточки" />
    <meta name="application-name" content="Карточки" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js').catch(function (err) {
            console.error('SW registration failed:', err);
          });
        });
      }
    </script>
  </head>`;
html = html.replace('</head>', head);

writeFileSync(indexPath, html, 'utf8');
console.log('[inject-pwa] patched dist/index.html (manifest, iOS meta, theme-color, SW).');
