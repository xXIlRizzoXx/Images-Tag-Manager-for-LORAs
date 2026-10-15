/* ITALIANO: PROVA DEL SERVER MCP (electron/mcp-server.src.mjs e la sua parte in main.cjs)
   Impacchetta il server con esbuild come fa la build, lo avvia su una porta libera di
   127.0.0.1 con un "programma" finto al posto della finestra, e gli parla con il client MCP
   ufficiale. Controlla: gli strumenti sono quelli previsti e nessuno salva sul disco; senza il
   codice giusto non si entra; una pagina web (Host o Origin non locali) viene respinta; la porta
   occupata viene detta; in main.cjs il server e' spento di serie e non parte se l'impostazione
   non si puo' salvare. Solo connessioni locali, niente finestre.
   Uso:  node scripts/test-mcp-server.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE MCP SERVER (electron/mcp-server.src.mjs and its part in main.cjs)
   Bundles the server with esbuild as the build does, starts it on a free 127.0.0.1 port with a
   fake "program" in place of the window, and talks to it with the official MCP client. Checks:
   the tools are the expected ones and none saves to disk; without the right token nobody gets
   in; a web page (non-local Host or Origin) is turned away; a busy port is reported; in
   main.cjs the server is off by default and does not start if the setting cannot be saved.
   Local connections only, no windows.
   Usage:  node scripts/test-mcp-server.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { caricaMain } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let guai = 0, fatti = 0;
const dice = (nome, atteso, avuto) => {
    fatti++;
    const ok = JSON.stringify(atteso) === JSON.stringify(avuto);
    if (!ok) guai++;
    console.log(`${ok ? 'OK ' : 'NO '} ${nome}${ok ? '' : `\n     atteso: ${JSON.stringify(atteso)}\n     avuto:  ${JSON.stringify(avuto)}`}`);
};

const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-mcp-'));
const pacchetto = path.join(cartella, 'mcp-server.cjs');
await esbuild.build({
    entryPoints: [path.join(radice, 'electron/mcp-server.src.mjs')],
    outfile: pacchetto, bundle: true, platform: 'node', format: 'cjs', target: 'node20', logLevel: 'silent',
});
const { avviaServerMcp, richiestaLocale } = require(pacchetto);

const CODICE = 'c'.repeat(32);
const domande = [];
const chiedi = async (strumento, argomenti) => {
    domande.push({ strumento, argomenti });
    if (strumento === 'get_photo') return { immagine: { data: 'QUJD', mimeType: 'image/jpeg' }, info: { id: argomenti.id } };
    if (strumento === 'set_tags') return { errore: 'No open photo has id "x".' };
    return { risultato: { strumento, argomenti } };
};
const server = await avviaServerMcp({ porta: 0, codice: CODICE, chiedi, versione: '2.0.0' });
const url = `http://127.0.0.1:${server.porta}/images-tag-manager`;

const crude = (opzioni, corpo) => new Promise((risolvi) => {
    const req = http.request({ host: '127.0.0.1', port: server.porta, path: '/images-tag-manager', method: 'POST', ...opzioni }, (res) => {
        res.resume();
        res.on('end', () => risolvi(res.statusCode));
    });
    req.on('error', () => risolvi('errore'));
    req.end(corpo === undefined ? JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) : corpo);
});
const BASE = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };

try {
    console.log('\n--- il client MCP ufficiale, col codice giusto ---');
    const client = new Client({ name: 'prova', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${CODICE}` } } }));
    const strumenti = (await client.listTools()).tools.map(t => t.name).sort();
    dice('gli strumenti sono esattamente questi', ['add_tags', 'get_photo', 'list_photos', 'list_project_tags', 'remove_tags', 'set_tags'], strumenti);
    dice('nessuno strumento salva, scrive o cancella file', [], strumenti.filter(n => /save|write|delete|trash|file|disk/i.test(n)));
    const descrizioni = (await client.listTools()).tools.filter(t => /tags$/.test(t.name) && t.name !== 'list_project_tags').map(t => t.description);
    dice('gli strumenti che cambiano i tag dicono che non si salva da soli', true, descrizioni.length === 3 && descrizioni.every(d => /Save Changes/.test(d)));

    const r1 = await client.callTool({ name: 'list_photos', arguments: { tags: ['smile'], limit: 5 } });
    dice('la domanda arriva al programma con i suoi argomenti', { strumento: 'list_photos', argomenti: { tags: ['smile'], limit: 5 } }, domande.at(-1));
    dice('...e la risposta torna all\'AI come testo', true, r1.content[0].type === 'text' && JSON.parse(r1.content[0].text).strumento === 'list_photos');
    const r2 = await client.callTool({ name: 'get_photo', arguments: { id: 'p1' } });
    dice('get_photo restituisce l\'immagine', { type: 'image', data: 'QUJD', mimeType: 'image/jpeg' }, r2.content[0]);
    const r3 = await client.callTool({ name: 'set_tags', arguments: { id: 'x', tags: ['a'] } });
    dice('un errore del programma arriva come errore dello strumento', [true, 'No open photo has id "x".'], [r3.isError, r3.content[0].text]);
    const prima = domande.length;
    const r4 = await client.callTool({ name: 'add_tags', arguments: { ids: [], tags: ['a'] } }).catch(e => ({ isError: true, eccezione: String(e) }));
    dice('argomenti sbagliati (nessun id) vengono respinti prima di arrivare al programma', [true, prima], [r4.isError === true, domande.length]);
    await client.close();

    console.log('\n--- chi non deve entrare ---');
    dice('senza codice: 401', 401, await crude({ headers: BASE }));
    dice('codice sbagliato: 401', 401, await crude({ headers: { ...BASE, Authorization: 'Bearer ' + 'd'.repeat(32) } }));
    dice('codice giusto ma Host di un altro sito (DNS rebinding): 403', 403, await crude({ headers: { ...BASE, Authorization: `Bearer ${CODICE}`, Host: `evil.example:${server.porta}` } }));
    dice('Origin di una pagina web: 403', 403, await crude({ headers: { ...BASE, Authorization: `Bearer ${CODICE}`, Origin: 'https://evil.example' } }));
    dice('Origin locale: accettato', 200, await crude({ headers: { ...BASE, Authorization: `Bearer ${CODICE}`, Origin: `http://localhost:${server.porta}` } }));
    dice('un altro indirizzo: 404', 404, await crude({ path: '/altro', headers: BASE }));
    dice('l\'indirizzo non contiene "mcp" (Avast riscrive male quel traffico)', false, /mcp/i.test(new URL(url).pathname));
    dice('GET: 405', 405, await crude({ method: 'GET', headers: { ...BASE, Authorization: `Bearer ${CODICE}` } }, ''));
    dice('corpo oltre 1 MB: 413', 413, await crude({ headers: { ...BASE, Authorization: `Bearer ${CODICE}` } }, 'x'.repeat(1100 * 1024)));
    dice('richiestaLocale: localhost sulla porta giusta', true, richiestaLocale({ host: 'localhost:5' }, 5));
    dice('richiestaLocale: porta diversa', false, richiestaLocale({ host: '127.0.0.1:6' }, 5));

    const intestazioni = await new Promise((risolvi) => {
        const req = http.request({ host: '127.0.0.1', port: server.porta, path: '/images-tag-manager', method: 'POST', headers: { ...BASE, Authorization: `Bearer ${CODICE}` } },
            (res) => { res.resume(); res.on('end', () => risolvi(res.headers)); });
        req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }));
    });
    // ITALIANO: Avast riscrive male le risposte MCP con la lunghezza dichiarata; quelle a blocchi passano.
    // ENGLISH: Avast breaks MCP responses that declare a length; chunked ones pass.
    dice('le risposte vanno a blocchi, senza lunghezza dichiarata (Avast)', ['chunked', undefined], [intestazioni['transfer-encoding'], intestazioni['content-length']]);

    console.log('\n--- porta occupata ---');
    const esito = await avviaServerMcp({ porta: server.porta, codice: CODICE, chiedi, versione: '2.0.0' }).then(() => 'partito', e => e.code);
    dice('la porta gia\' usata viene detta (EADDRINUSE)', 'EADDRINUSE', esito);
} finally {
    await server.chiudi();
    fs.rmSync(cartella, { recursive: true, force: true });
}

console.log('\n--- il sorgente ---');
{
    const src = fs.readFileSync(path.join(radice, 'electron/mcp-server.src.mjs'), 'utf8');
    dice('ascolta solo su 127.0.0.1', true, /\.listen\(porta, '127\.0\.0\.1'/.test(src));
    dice('non tocca il disco (niente fs)', false, /from 'node:fs'|require\('fs'\)|from 'fs'/.test(src));
    const main = fs.readFileSync(path.join(radice, 'electron/main.cjs'), 'utf8');
    dice('main.cjs carica il server solo quando lo si accende', true, /require\('\.\/mcp-server\.cjs'\)/.test(main) && !/^const .*require\('\.\/mcp-server\.cjs'\)/m.test(main));
    dice('risponde solo la finestra principale', true, /event\.sender !== mainWindow\.webContents/.test(main));
    const pkg = JSON.parse(fs.readFileSync(path.join(radice, 'package.json'), 'utf8'));
    dice('la build impacchetta il server e lo mette nell\'eseguibile', true, /build:mcp/.test(pkg.scripts['electron:build']) && pkg.build.files.includes('electron/mcp-server.cjs'));
}

console.log('\n--- in main.cjs ---');
{
    const { handlers } = caricaMain();
    const stato = await handlers.get('mcp:get-status')();
    dice('spento di serie, nessun codice inventato senza accenderlo', { acceso: false, attivo: false, codice: '' }, { acceso: stato.acceso, attivo: stato.attivo, codice: stato.codice });
    // ITALIANO: la cartella dei dati del finto non esiste: l'impostazione non si salva.
    // ENGLISH: the fake's data folder does not exist: the setting cannot be saved.
    const erroreVero = console.error;
    console.error = () => {};
    const dopo = await handlers.get('mcp:set-enabled')({}, true);
    console.error = erroreVero;
    dice('se l\'impostazione non si salva il server NON parte, e lo dice', [false, false, 'salvataggio'], [dopo.acceso, dopo.attivo, dopo.errore]);
}

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
