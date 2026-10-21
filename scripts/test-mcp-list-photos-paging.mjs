/* ITALIANO: PROVA DELLE ISTRUZIONI DI list_photos PER LE PAGINE (SERVER MCP)
   Con untagged_only (o tags) l'elenco si ricalcola a ogni chiamata sui tag di adesso. Un'AI che tagga
   la prima pagina e poi chiede offset 100 salta le foto da 100 a 199. La regola data dopo ("richiedi
   da offset 0 finche' total e' 0") sbagliava a sua volta: con il filtro tags e add_tags le foto
   restano nell'elenco (hanno ancora il tag cercato), offset 0 da' sempre le stesse 100 foto e le altre
   150 non vengono mai toccate; con untagged_only e foto che l'AI non tagga (TIFF/HEIC che get_photo
   non sa mostrare) total non arriva mai a 0 e il giro non finisce. Ora le descrizioni dicono di
   leggere prima tutte le pagine senza cambiare niente (offset avanza del numero di foto avute, ci si
   ferma alla pagina vuota) e di cambiare i tag solo dopo. Si leggono le descrizioni vere dal server
   MCP vero (electron/mcp-server.src.mjs, porta 0, client MCP ufficiale) e si prova, con il vero
   src/utils/mcpBridge.ts, che il giro indicato funziona in tutti i casi (anche senza filtro).
   Uso:  node scripts/test-mcp-list-photos-paging.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE list_photos PAGING INSTRUCTIONS (MCP SERVER)
   With untagged_only (or tags) the list is computed again at every call from the current tags. An AI
   that tags the first page and then asks for offset 100 skips photos 100 to 199. The rule given next
   ("ask again from offset 0 until total is 0") was wrong in turn: with the tags filter and add_tags
   the photos stay in the list (they still have the tag searched for), offset 0 always gives the same
   100 photos and the other 150 are never touched; with untagged_only and photos the AI does not tag
   (TIFF/HEIC that get_photo cannot show) total never reaches 0 and the loop never ends. Now the
   descriptions say to read every page first without changing anything (offset advances by the number
   of photos returned, stop at the empty page) and to change the tags only afterwards. The real
   descriptions are read from the real MCP server (electron/mcp-server.src.mjs, port 0, official MCP
   client), and the real src/utils/mcpBridge.ts shows that the loop described works in every case
   (also without a filter).
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
        const tutte = [descr, prop.offset?.description, prop.untagged_only?.description].join(' ');
        dice('list_photos: dice che con un filtro l\'elenco si ricalcola a ogni chiamata', true,
            /untagged_only/.test(descr) && /computed again at every call/.test(descr));
        dice('list_photos: dice che una foto cambiata esce SOLO se non corrisponde piu\' al filtro', true,
            /only if it no longer matches/.test(descr));
        dice('list_photos: prima si leggono tutte le pagine senza cambiare niente, poi si cambiano i tag', true,
            /first read all its pages without changing anything/.test(descr) && /only then change the tags/.test(descr));
        dice('list_photos: offset avanza del numero di foto avute e ci si ferma alla pagina vuota', true,
            /advance offset by the number of photos returned/.test(descr) && /empty/.test(descr));
        dice('offset: avanza del numero di foto avute, si legge tutto prima di cambiare i tag', true,
            /advance it by the number of photos returned/.test(prop.offset?.description || '')
            && /read all the pages before you change any tags/.test(prop.offset?.description || ''));
        dice('untagged_only: le foto lasciate senza tag restano, si annotano gli id prima di taggare', true,
            /stay in it/.test(prop.untagged_only?.description || '') && /note the ids before you start tagging/.test(prop.untagged_only?.description || ''));
        dice('la regola vecchia ("offset 0 finche\' total e\' 0", "non avanzare offset") non c\'e\' piu\'', false,
            /total is 0/.test(tutte) || /do not advance/i.test(tutte) || /offset 0/.test(tutte));
        dice('tags dice ancora che servono TUTTI i tag (come prima)', true, /ALL these tags/.test(prop.tags?.description || ''));
    } finally {
        await server.chiudi();
    }
} finally {
    fs.rmSync(cartella, { recursive: true, force: true });
}

console.log('\n--- il giro indicato funziona con tutti i filtri ---');
{
    const out = await esbuild.build({ entryPoints: [path.join(radice, 'src/utils/mcpBridge.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    const B = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
    const crea = (tags) => Array.from({ length: 250 }, (_, i) => ({ id: 'p' + i, file: { name: `p${i}.png` }, tags: [...tags], originalTags: [...tags] }));
    const contesto = (foto) => ({ foto: () => foto, trigger: () => [], applica: (m) => { for (const [id, tags] of m) foto.find(f => f.id === id).tags = tags; }, immagine: async () => null });
    // ITALIANO: il giro delle descrizioni nuove: leggere tutte le pagine (offset += foto avute, stop alla pagina vuota), poi cambiare.
    // ENGLISH: the loop of the new descriptions: read every page (offset += photos returned, stop at the empty page), then change.
    const giroNuovo = async (filtro, cambia, ctx) => {
        const id = [];
        let offset = 0, chiamate = 0;
        while (chiamate++ < 50) {
            const r = (await B.eseguiStrumentoMcp('list_photos', { ...filtro, offset, limit: 100 }, ctx)).risultato;
            if (r.photos.length === 0) break;
            id.push(...r.photos.map(p => p.id));
            offset += r.photos.length;
            if (offset >= r.total) break;
        }
        await cambia(id, ctx);
        return { chiamate, id };
    };
    // ITALIANO: la regola vecchia, presa alla lettera: cambiare una pagina e richiedere da offset 0 finche' total e' 0 (al massimo 6 giri).
    // ENGLISH: the old rule, taken literally: change a page and ask again from offset 0 until total is 0 (at most 6 rounds).
    const giroVecchio = async (filtro, cambia, ctx) => {
        let giri = 0;
        for (; giri < 6; giri++) {
            const r = (await B.eseguiStrumentoMcp('list_photos', { ...filtro, offset: 0, limit: 100 }, ctx)).risultato;
            if (r.total === 0) break;
            await cambia(r.photos.map(p => p.id), ctx);
        }
        return giri;
    };
    const aggiungiBassa = async (id, ctx) => { if (id.length) await B.eseguiStrumentoMcp('add_tags', { ids: id, tags: ['low quality'] }, ctx); };
    const NON_TAGGABILI = new Set(['p7', 'p120', 'p249']);
    const taggaTranne = async (id, ctx) => { for (const x of id) if (!NON_TAGGABILI.has(x)) await B.eseguiStrumentoMcp('set_tags', { id: x, tags: ['1girl'] }, ctx); };
    const taggaTutte = async (id, ctx) => { for (const x of id) await B.eseguiStrumentoMcp('set_tags', { id: x, tags: ['1girl'] }, ctx); };

    {   // tags ['blurry'] + add_tags 'low quality': le foto restano nell'elenco
        const foto = crea(['blurry']);
        await giroNuovo({ tags: ['blurry'] }, aggiungiBassa, contesto(foto));
        dice('filtro tags blurry + add_tags: tutte e 250 le foto ricevono "low quality"', 250, foto.filter(f => f.tags.includes('low quality')).length);
        const vecchie = crea(['blurry']);
        await giroVecchio({ tags: ['blurry'] }, aggiungiBassa, contesto(vecchie));
        dice('(con la regola vecchia ne restavano 150 non toccate)', 150, vecchie.filter(f => !f.tags.includes('low quality')).length);
    }
    {   // untagged_only con 3 foto che l'AI non tagga: il giro deve finire
        const foto = crea([]);
        const { chiamate } = await giroNuovo({ untagged_only: true }, taggaTranne, contesto(foto));
        dice('untagged_only con 3 foto non taggabili: il giro finisce con 3 chiamate', 3, chiamate);
        dice('untagged_only con 3 foto non taggabili: le altre 247 sono taggate, restano solo le 3', ['p120', 'p249', 'p7'],
            foto.filter(f => f.tags.length === 0).map(f => f.id).sort());
        const vecchie = crea([]);
        dice('(con la regola vecchia il giro non finiva: arriva al tetto di 6 giri)', 6, await giroVecchio({ untagged_only: true }, taggaTranne, contesto(vecchie)));
    }
    {   // casi vicini che devono restare giusti
        const foto = crea([]);
        await giroNuovo({ untagged_only: true }, taggaTutte, contesto(foto));
        dice('untagged_only, AI che tagga tutto: nessuna foto resta senza tag', 0, foto.filter(f => f.tags.length === 0).length);
        const bl = crea(['blurry']);
        await giroNuovo({ tags: ['blurry'] }, async (id, ctx) => { await B.eseguiStrumentoMcp('remove_tags', { ids: id, tags: ['blurry'] }, ctx); }, contesto(bl));
        dice('filtro tags blurry + remove_tags blurry (le foto escono): tolto da tutte e 250', 0, bl.filter(f => f.tags.includes('blurry')).length);
        const libere = crea(['x']);
        const { id } = await giroNuovo({}, async () => {}, contesto(libere));
        dice('senza filtro: le pagine danno tutte e 250 le foto, una volta sola', 250, new Set(id).size === id.length ? id.length : -1);
    }
}

process.exit(esito());
