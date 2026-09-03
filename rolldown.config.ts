import { defineConfig } from 'rolldown';
import pkg from './package.json' with { type: 'json' };

const banner = `/*! squigRanking v${pkg.version} | MIT | https://github.com/squigRanking */`;

// One IIFE per output. The page loads a single plain <script>, so nothing in
// the bundle may rely on module scope or a loader being present.
const base = {
  input: 'src/main.ts',
  platform: 'browser' as const,
};

export default defineConfig([
  {
    ...base,
    output: { file: 'dist/core.js', format: 'iife', banner, sourcemap: true },
  },
  {
    ...base,
    output: { file: 'dist/core.min.js', format: 'iife', banner, minify: true, sourcemap: true },
  },
]);
