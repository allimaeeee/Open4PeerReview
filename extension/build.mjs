import { build } from 'esbuild';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, 'src');
const OUT = resolve(__dirname, 'dist');

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const isDev = process.env.OERHUB_ENV === 'dev';
const OERHUB_URL = isDev ? 'http://localhost:3000' : 'https://oerhub.vercel.app';

const base = {
  bundle: true,
  platform: 'browser',
  target: 'chrome120',
  minify: false,
  sourcemap: true,
};

console.log(`  Building extension for ${isDev ? 'DEV (localhost:3000)' : 'PRODUCTION'} — OERHUB_URL=${OERHUB_URL}`);

await Promise.all([
  build({
    ...base,
    entryPoints: [resolve(SRC, 'background.ts')],
    outfile: resolve(OUT, 'background.js'),
    format: 'esm',
  }),
  build({
    ...base,
    loader: { '.woff2': 'dataurl' },
    define: { __OERHUB_URL__: JSON.stringify(OERHUB_URL) },
    entryPoints: [resolve(SRC, 'content.ts')],
    outfile: resolve(OUT, 'content.js'),
    format: 'iife',
  }),
  build({
    ...base,
    loader: { '.woff2': 'dataurl' },
    entryPoints: [resolve(SRC, 'popup.ts')],
    outfile: resolve(OUT, 'popup.js'),
    format: 'iife',
  }),
  build({
    ...base,
    entryPoints: [resolve(SRC, 'dashboard.ts')],
    outfile: resolve(OUT, 'dashboard.js'),
    format: 'iife',
  }),
]);

copyFileSync(resolve(__dirname, 'manifest.json'), resolve(OUT, 'manifest.json'));
copyFileSync(resolve(SRC, 'popup.html'), resolve(OUT, 'popup.html'));

console.log('✓ Extension built → extension/dist/');
console.log('  Load extension/dist/ as an unpacked extension in Chrome.');
