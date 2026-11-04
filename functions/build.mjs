// Bundles the functions with esbuild. @casepilot/shared is compiled into lib/ because
// `firebase deploy` installs dependencies in Cloud Build and cannot resolve workspace packages.
// Everything listed in package.json "dependencies" stays external and is installed at deploy.
import { context, build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: true,
  external: Object.keys(pkg.dependencies ?? {}),
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
