/* ITALIANO: PROVA DELLE DIDASCALIE IN FRASE LUNGHE VIA MCP
   L'app accetta tag fino a 4000 caratteri (TXT_TAG_MAX_CHARS in src/utils/sidecarTags.ts) apposta per le
   didascalie in frase Flux/SDXL (120-300 caratteri senza virgole). Il server MCP invece respingeva ogni tag
   oltre 200 caratteri ("String must contain at most 200 character(s)") e mcpBridge.ts li tagliava in
   silenzio a 200: una foto con la didascalia lunga non si poteva aggiornare con set_tags rimandando i suoi
   stessi tag. Si usano il server MCP vero (porta 0, client MCP ufficiale) e il vero mcpBridge: una
   didascalia di 250 caratteri passa da set_tags e add_tags e arriva intera in memoria; un tag oltre 4000
   caratteri resta respinto dal server e tagliato a 4000 dal ponte. Solo connessioni locali.
   Uso:  node scripts/test-mcp-long-caption.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF LONG SENTENCE CAPTIONS THROUGH MCP
   The app accepts tags up to 4000 characters (TXT_TAG_MAX_CHARS) on purpose for Flux/SDXL sentence
   captions. The MCP server rejected every tag over 200 characters and mcpBridge.ts cut them silently at
   200. With the real MCP server (port 0, official MCP client) and the real mcpBridge: a 250-character
   caption goes through set_tags and add_tags and arrives whole in memory; a tag over 4000 characters is
   still rejected by the server and cut at 4000 by the bridge. Local connections only.
   Usage:  node scripts/test-mcp-long-caption.mjs      (exits with code 1 if anything is off) */

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

const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/mcpBridge.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const B = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
const sidecar = await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/sidecarTags.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const { TXT_TAG_MAX_CHARS } = await import('data:text/javascript;base64,' + Buffer.from(sidecar.outputFiles[0].text).toString('base64'));

// ITALIANO: una didascalia in frase senza virgole, lunga 250 caratteri. ENGLISH: a 250-character sentence caption, no commas.
const frase = (inizio) => (inizio + ' woman standing in a sunny park with tall green trees and a small pond in the background while she smiles warmly at the camera and holds a white coffee cup in her right hand during golden hour light with soft shadows on the green grass near the old wooden bench').slice(0, 250);
const lunga = frase('a photo of ohwx');
const nuova = frase('a close photo of ohwx');

let foto = [];
const ctx = {
    foto: () => foto,
    trigger: () => ['ohwx'],
    applica: (n) => { foto = foto.map(f => (n.has(f.id) ? { ...f, tags: n.get(f.id) } : f)); },
    immagine: async () => null,
};
const tagDi = (id) => foto.find(f => f.id === id).tags;

console.log('\n--- dal server MCP vero ---');
const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-mcp-caption-'));
try {
    const pacchetto = path.join(cartella, 'mcp-server.cjs');
    await esbuild.build({
        entryPoints: [path.join(radice, 'electron/mcp-server.src.mjs')],
        outfile: pacchetto, bundle: true, platform: 'node', format: 'cjs', target: 'node20', logLevel: 'silent',
    });
    const { avviaServerMcp } = require(pacchetto);
    const CODICE = 'c'.repeat(32);
    const server = await avviaServerMcp({ porta: 0, codice: CODICE, chiedi: (s, a) => B.eseguiStrumentoMcp(s, a, ctx), versione: '2.0.1' });
    try {
        const client = new Client({ name: 'prova', version: '1.0.0' });
        await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.porta}/images-tag-manager`),
            { requestInit: { headers: { Authorization: `Bearer ${CODICE}` } } }));
        const chiama = async (name, args) => {
            const r = await client.callTool({ name, arguments: args }).catch(e => ({ isError: true, content: [{ text: String(e && e.message) }] }));
            return { errore: r.isError === true ? String(r.content?.[0]?.text || '') : '', testo: r.content?.[0]?.text || '' };
        };
        dice('premessa: la didascalia e\' lunga 250 caratteri e senza virgole', [250, false], [lunga.length, lunga.includes(',')]);

        foto = [{ id: 'p1', file: { name: 'a.png' }, tags: ['ohwx', lunga], originalTags: ['ohwx', lunga] }];
        const leggi = (testo) => { try { return JSON.parse(testo); } catch (_) { return { total: -1, photos: [] }; } };
        const letti = (leggi((await chiama('list_photos', {})).testo).photos[0] || { tags: [] }).tags;
        dice('list_photos restituisce la didascalia intera', 250, (letti[1] || '').length);
        const r1 = await chiama('set_tags', { id: 'p1', tags: [...letti, 'outdoors'] });
        dice('set_tags che rimanda i tag letti piu\' uno nuovo: accettato', '', r1.errore);
        dice('...e la didascalia resta intera in memoria', ['ohwx', lunga, 'outdoors'], tagDi('p1'));

        foto = [{ id: 'p1', file: { name: 'a.png' }, tags: ['ohwx'], originalTags: ['ohwx'] }];
        const r2 = await chiama('set_tags', { id: 'p1', tags: [lunga] });
        dice('set_tags con una didascalia di 250 caratteri: accettato e intero', ['', 250], [r2.errore, (tagDi('p1')[1] || '').length]);
        const r3 = await chiama('add_tags', { ids: ['p1'], tags: [nuova] });
        dice('add_tags con una didascalia di 250 caratteri: accettato e intero', ['', true], [r3.errore, tagDi('p1').includes(nuova)]);
        const r4 = await chiama('remove_tags', { ids: ['p1'], tags: [lunga] });
        dice('remove_tags con la didascalia lunga: la toglie', ['', false], [r4.errore, tagDi('p1').includes(lunga)]);
        foto = [{ id: 'p1', file: { name: 'a.png' }, tags: ['ohwx', lunga], originalTags: ['ohwx', lunga] }, { id: 'p2', file: { name: 'b.png' }, tags: ['ohwx'], originalTags: ['ohwx'] }];
        const r5 = leggi((await chiama('list_photos', { tags: [lunga] })).testo);
        dice('list_photos filtrato per la didascalia lunga: trova la sua foto', [1, 'p1'], [r5.total, r5.photos[0] && r5.photos[0].id]);

        // ITALIANO: il tetto c'e' ancora, uguale a quello dei .txt. ENGLISH: the cap is still there, equal to the .txt one.
        dice('premessa: il tetto dei .txt e\' 4000 caratteri', 4000, TXT_TAG_MAX_CHARS);
        foto = [{ id: 'p1', file: { name: 'a.png' }, tags: ['ohwx'], originalTags: ['ohwx'] }];
        const r6 = await chiama('set_tags', { id: 'p1', tags: ['x'.repeat(TXT_TAG_MAX_CHARS)] });
        dice('un tag di esattamente 4000 caratteri passa intero', ['', TXT_TAG_MAX_CHARS], [r6.errore, (tagDi('p1')[1] || '').length]);
        foto = [{ id: 'p1', file: { name: 'a.png' }, tags: ['ohwx'], originalTags: ['ohwx'] }];
        const r7 = await chiama('set_tags', { id: 'p1', tags: ['x'.repeat(TXT_TAG_MAX_CHARS + 1)] });
        dice('un tag di 4001 caratteri viene respinto dal server e la foto non cambia', [true, ['ohwx']], [/4000/.test(r7.errore), tagDi('p1')]);
        await client.close();
    } finally {
        await server.chiudi();
    }
} finally {
    fs.rmSync(cartella, { recursive: true, force: true });
}

console.log('\n--- il ponte da solo ---');
dice('pulisciTag tiene intera una didascalia di 250 caratteri', 250, B.pulisciTag([lunga])[0].length);
dice('pulisciTag taglia a 4000 un tag piu\' lungo, come i .txt', TXT_TAG_MAX_CHARS, B.pulisciTag(['x'.repeat(5000)])[0].length);
foto = [{ id: 'p1', file: { name: 'a.png' }, tags: ['ohwx'], originalTags: ['ohwx'] }];
await B.eseguiStrumentoMcp('set_tags', { id: 'p1', tags: [lunga] }, ctx);
dice('set_tags chiamato direttamente: la didascalia arriva intera in memoria', 250, (tagDi('p1')[1] || '').length);

process.exit(esito());
