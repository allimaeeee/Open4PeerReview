import { ZipArchive } from 'archiver';
import { createWriteStream, existsSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, 'dist');
const OUT_ZIP = resolve(__dirname, 'dist.zip');

if (!existsSync(DIST)) {
  console.error(`✗ ${DIST} does not exist — run \`npm run build:ext\` first.`);
  process.exit(1);
}

const output = createWriteStream(OUT_ZIP);
const archive = new ZipArchive({ zlib: { level: 9 } });

output.on('close', () => {
  const { size } = statSync(OUT_ZIP);
  console.log(`✓ Packaged extension → ${OUT_ZIP} (${size.toLocaleString()} bytes)`);
});

archive.on('warning', (err) => { throw err; });
archive.on('error', (err) => { throw err; });

archive.pipe(output);
// Glob from DIST with no destpath so entries land at the archive root, not nested in dist/.
archive.glob('**/*', { cwd: DIST, dot: true });
await archive.finalize();
