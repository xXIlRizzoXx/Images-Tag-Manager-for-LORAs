/* ITALIANO: PROVA DELLA SPIEGAZIONE SULLE VIRGOLE PER L'AI ESTERNA (SERVER MCP)
   Nel .txt la virgola separa i tag, quindi il programma divide un tag a ogni virgola. Nella prova dal
   vivo del 23/10/2026 un'AI ha scritto una didascalia in frase con 8 virgole: e' diventata 9 tag, e la
   risposta ("changed": 1) non lo diceva. Le descrizioni degli strumenti non ne parlavano. Ora set_tags,
   add_tags e remove_tags lo dicono, e la divisione resta com'era (e' voluta).
   Si avvia il server MCP vero (impacchettato come nella build) con il vero src/utils/mcpBridge.ts e gli
   si parla con il client MCP ufficiale. Solo 127.0.0.1, niente finestre.
   Uso:  node scripts/test-mcp-comma-note.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE COMMA EXPLANATION FOR THE EXTERNAL AI (MCP SERVER)
   In the .txt the comma separates tags, so the program splits a tag at every comma. In the live test
   of 23/10/2026 an AI wrote a sentence caption with 8 commas: it became 9 tags, and the answer
   ("changed": 1) did not say so. The tool descriptions did not mention it. Now set_tags, add_tags and
   remove_tags say it, and the split stays as it was (it is intended).
   The real MCP server (bundled as in the build) runs with the real src/utils/mcpBridge.ts and is
   spoken to with the official MCP client. 127.0.0.1 only, no windows.
   Usage:  node scripts/test-mcp-comma-note.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { dice, esito } = creaControlli();

const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/mcpBridge.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const B = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));

let foto = [{ id: 'p1', file: { name: 'a.png' }, tags: ['wind'], originalTags: ['wind'] }];
const ctx = {
    foto: () => foto,
    trigger: () => [],
    applica: (n) => { foto = foto.map(f => (n.has(f.id) ? { ...f, tags: n.get(f.id) } : f)); },
    immagine: async () => null,
};

const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-mcp-comma-'));
try {
    const pacchetto = path.join(cartella, 'mcp-server.cjs');
    await esbuild.build({
        entryPoints: [path.join(radice, 'electron/mcp-server.src.mjs')],
        outfile: pacchetto, bundle: true, platform: 'node', format: 'cjs', target: 'node20', logLevel: 'silent',
    });
    const { avviaServerMcp } = require(pacchetto);
    const CODICE = 'v'.repeat(32);
    const server = await avviaServerMcp({ porta: 0, codice: CODICE, chiedi: (s, a) => B.eseguiStrumentoMcp(s, a, ctx), versione: '2.0.2' });
    try {
        const client = new Client({ name: 'prova', version: '1.0.0' });
        await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.porta}/images-tag-manager`),
            { requestInit: { headers: { Authorization: `Bearer ${CODICE}` } } }));

        console.log('\n--- le descrizioni che l\'AI legge ---');
        const { tools } = await client.listTools();
        const desc = Object.fromEntries(tools.map(t => [t.name, t.description || '']));
        for (const nome of ['set_tags', 'add_tags']) {
            dice(`${nome}: dice che la virgola divide il tag e di scrivere le frasi senza virgole`, true,
                /A comma inside a tag splits it into separate tags/.test(desc[nome]) && /without commas/.test(desc[nome]));
        }
        dice('remove_tags: dice che anche qui la virgola divide, e che ogni pezzo si toglie da solo', true,
            /A comma inside a tag splits it here too/.test(desc.remove_tags) && /each piece is removed on its own/.test(desc.remove_tags));
        dice('le descrizioni dicono ancora che niente si salva da solo', true,
            ['set_tags', 'add_tags', 'remove_tags'].every(n => /nothing is written to disk until the user presses "Save Changes"/.test(desc[n])));
        dice('gli strumenti di sola lettura non parlano di virgole', true,
            ['list_photos', 'get_photo', 'list_project_tags'].every(n => !/A comma inside a tag/.test(desc[n])));

        console.log('\n--- il comportamento resta quello descritto ---');
        const chiama = async (name, args) => {
            const r = await client.callTool({ name, arguments: args });
            return r.content?.[0]?.text || '';
        };
        await chiama('add_tags', { ids: ['p1'], tags: ['soft light, rim light, wind'] });
        dice('add_tags con due virgole: tre tag, e "wind" che c\'era resta uno solo', ['rim light', 'soft light', 'wind'], [...foto[0].tags].sort());
        await chiama('remove_tags', { ids: ['p1'], tags: ['soft light, wind'] });
        dice('remove_tags con una virgola: toglie i due pezzi, compreso "wind"', ['rim light'], foto[0].tags);
        await client.close();
    } finally {
        await server.chiudi();
    }
} finally {
    fs.rmSync(cartella, { recursive: true, force: true });
}

process.exit(esito());
