/* بناء حزمة Firebase محليًا → dist/firebase.js
   الاستخدام: node build.mjs   |   node build.mjs --watch  */
import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('vendor', { recursive: true });

const options = {
  entryPoints: ['src/firebase-entry.js'],
  bundle: true,
  format: 'esm',
  outfile: 'vendor/firebase.js',
  minify: true,
  target: ['es2020'],
  legalComments: 'none',
  logLevel: 'info'
};

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('👀 watching src/firebase-entry.js → vendor/firebase.js');
} else {
  await esbuild.build(options);
  console.log('✅ vendor/firebase.js جاهز');
}
