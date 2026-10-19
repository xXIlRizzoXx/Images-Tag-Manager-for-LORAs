/* ITALIANO: PROVA DELLE ISTRUZIONI DI list_photos PER LE PAGINE (SERVER MCP)
   Con untagged_only (o tags) l'elenco si ricalcola a ogni chiamata sui tag di adesso: le foto che
   l'AI tagga escono dall'elenco e le altre salgono. Un'AI che tagga la prima pagina e poi chiede
   offset 100 salta le foto da 100 a 199, e con offset 150 trova la lista vuota e dice di aver
   finito: 100 foto restano senza tag. La descrizione dello strumento non lo diceva (offset non
   aveva nemmeno una descrizione). Ora la descrizione di list_photos, di offset e di untagged_only
   dice di richiedere da offset 0 finche' total non vale 0. Si leggono le descrizioni vere dal
   server MCP vero (electron/mcp-server.src.mjs, porta 0, client MCP ufficiale) e si prova, con il
   vero src/utils/mcpBridge.ts, che il giro indicato tagga davvero tutte le foto.
   Uso:  node scripts/test-mcp-list-photos-paging.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE list_photos PAGING INSTRUCTIONS (MCP SERVER)
   With untagged_only (or tags) the list is computed again at every call from the current tags: the
   photos the AI tags leave the list and the others move up. An AI that tags the first page and then
   asks for offset 100 skips photos 100 to 199, and at offset 150 finds the list empty and says it is
   done: 100 photos stay untagged. The tool description did not say so (offset had no description at
   all). Now the description of list_photos, offset and untagged_only says to ask again from offset 0
   until total is 0. The real descriptions are read from the real MCP server
   (electron/mcp-server.src.mjs, port 0, official MCP client), and the real src/utils/mcpBridge.ts
   shows that the loop described really tags every photo.
   Usage:  node scripts/test-mcp-list-photos-paging.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { dice, esito } = creaControlli();

console.log('\n--- le descrizioni che l\'AI legge ---');
const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-mcp-paging-'));
try {
    const pacchetto = path.join(cartella, 'mcp-server.cjs');
    await esbuild.build({
        entryPoints: [path.join(radice, 'electron/mcp-server.src.mjs')],
        outfile: pacchetto, bundle: true, platform: 'node', format: 'cjs', target: 'node20', logLevel: 'silent',
    });
    const { avviaServerMcp } = require(pacchetto);
    const CODICE = 'c'.repeat(32);
    const server = await avviaServerMcp({ porta: 0, codice: CODICE, chiedi: async () => ({ risultato: {} }), versione: '2.0.1' });
    try {
        const client = new Client({ name: 'prova', version: '1.0.0' });
        await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.porta}/images-tag-manager`),
            { requestInit: { headers: { Authorization: `Bearer ${CODICE}` } } }));
        const lista = (await client.listTools()).tools.find(t => t.name === 'list_photos');
        await client.close();
        const descr = lista?.description || '';
        const prop = lista?.inputSchema?.properties || {};
        const dice0 = (testo) => /offset 0/.test(testo || '') && /total is 0/.test(testo || '');
        dice('list_photos: con un filtro le foto cambiate escono dall\'elenco, si richiede da offset 0 finche\' total e\' 0', true,
            /untagged_only/.test(descr) && /leave/.test(descr) && dice0(descr));
        dice('offset ha una descrizione che dice di non avanzarlo mentre si cambiano i tag', true,
            /do not advance/i.test(prop.offset?.description || '') && /offset 0/.test(prop.offset?.description || ''));
        dice('untagged_only dice che le foto taggate escono e di richiedere da offset 0', true, dice0(prop.untagged_only?.description));
        dice('tags dice ancora che servono TUTTI i tag (come prima)', true, /ALL these tags/.test(prop.tags?.description || ''));
    } finally {
        await server.chiudi();
    }
} finally {
    fs.rmSync(cartella, { recursive: true, force: true });
}

console.log('\n--- il giro indicato tagga davvero tutte le foto ---');
{
    const out = await esbuild.build({ entryPoints: [path.join(radice, 'src/utils/mcpBridge.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    const B = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
    const nuove = () => Array.from({ length: 250 }, (_, i) => ({ id: 'p' + i, file: { name: `p${i}.png` }, tags: [], originalTags: [] }));
    const giro = async (avanza) => {
        const foto = nuove();
        const ctx = { foto: () => foto, trigger: () => [], applica: (m) => { for (const [id, tags] of m) foto.find(f => f.id === id).tags = tags; }, immagine: async () => null };
        let offset = 0;
        for (let i = 0; i < 10; i++) {
            const r = (await B.eseguiStrumentoMcp('list_photos', { untagged_only: true, offset, limit: 100 }, ctx)).risultato;
            if (r.total === 0 || r.photos.length === 0) break;
            for (const p of r.photos) await B.eseguiStrumentoMcp('set_tags', { id: p.id, tags: ['1girl'] }, ctx);
            if (avanza) offset += r.photos.length;
        }
        return foto.filter(f => f.tags.length === 0).length;
    };
    dice('sempre da offset 0 finche\' total e\' 0: nessuna foto resta senza tag', 0, await giro(false));
    dice('(avanzando offset, come faceva un\'AI senza istruzioni, ne restavano 100)', 100, await giro(true));
}

process.exit(esito());
