/* ITALIANO: impacchetta il server MCP (electron/mcp-server.src.mjs) con la libreria MCP e zod in
   un solo file, electron/mcp-server.cjs, che il processo principale carica quando il server si
   accende. Serve perche' l'eseguibile non porta node_modules (vedi "files" in package.json).
   Il file prodotto non va su git: si rifa' a ogni build (npm run build:mcp).
   Uso:  node scripts/build-mcp.mjs

   ENGLISH: bundles the MCP server (electron/mcp-server.src.mjs) with the MCP library and zod into
   a single file, electron/mcp-server.cjs, which the main process loads when the server is
   switched on. Needed because the executable carries no node_modules (see "files" in
   package.json). The output is not tracked by git: it is rebuilt on every build.
   Usage:  node scripts/build-mcp.mjs */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uscita = path.join(radice, 'electron/mcp-server.cjs');
await esbuild.build({
    entryPoints: [path.join(radice, 'electron/mcp-server.src.mjs')],
    outfile: uscita,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    legalComments: 'inline',
    logLevel: 'warning',
});
console.log('MCP server bundled: ' + path.relative(radice, uscita));
