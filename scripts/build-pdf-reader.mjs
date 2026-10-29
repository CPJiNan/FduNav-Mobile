import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const result = await build({
  entryPoints: ['scripts/pdf-reader-entry.js'],
  bundle: true,
  write: false,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: 'esnext',
  legalComments: 'none',
  outfile: 'pdf-reader.js',
});
await mkdir('src/generated', { recursive: true });
await writeFile(
  'src/generated/pdf-reader.ts',
  'export const pdfReaderScript=' +
    JSON.stringify(result.outputFiles.find((file) => file.path.endsWith('pdf-reader.js')).text) +
    ';\n',
);
await writeFile(
  'src/generated/pdf-reader.LICENSE.txt',
  'PDF.js — Copyright 2024 Mozilla Foundation\n\n' +
    (await readFile('node_modules/pdfjs-dist/LICENSE', 'utf8')),
);
