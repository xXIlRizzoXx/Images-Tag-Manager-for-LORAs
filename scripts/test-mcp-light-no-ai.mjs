/* ITALIANO: PROVA DEL SEMAFORO MCP ROSSO FINCHE' NESSUNA AI SI COLLEGA (2.0.3)
   Prima il semaforo era verde appena il server ascoltava, anche senza nessuna AI collegata: chi
   aveva dato il comando sbagliato a un'AI vedeva verde e pensava che il collegamento ci fosse. Il
   server e' "senza sessione" (nessuna linea resta aperta), quindi l'unica cosa che si puo' sapere
   e' se un'AI col codice giusto ha gia' parlato al programma, e quando. La regola: il server
   segnala un contatto SOLO per le richieste col codice giusto; main.cjs ricorda l'ultimo contatto,
   lo azzera spegnendo il server o creando un codice nuovo, e ignora i contatti del server vecchio;
   la pagina mostra rosso finche' non c'e' un contatto, verde dopo, giallo con un'AI al lavoro, il
   triangolo rosso se il server non parte. Server vero su una porta libera di 127.0.0.1 col client
   MCP ufficiale; main.cjs vero con un Electron e un server finti. Niente finestre, niente rete.
   Uso:  node scripts/test-mcp-light-no-ai.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE MCP LIGHT RED UNTIL AN AI CONNECTS (2.0.3)
   Before, the light was green as soon as the server listened, even with no AI connected: whoever
   had given an AI the wrong command saw green and thought the connection was there. The server is
   stateless (no line stays open), so the only thing that can be known is whether an AI with the
   right token has already talked to the app, and when. The rule: the server reports a contact ONLY
   for requests with the right token; main.cjs remembers the last contact, clears it when the
   server is switched off or a new token is created, and ignores contacts from the old server; the
   page shows red until there is a contact, green after, yellow with an AI at work, the red
   triangle if the server does not start. Real server on a free 127.0.0.1 port with the official
   MCP client; real main.cjs with a fake Electron and a fake server. No windows, no network.
   Usage:  node scripts/test-mcp-light-no-ai.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { creaControlli } from './main-harness.mjs';

const require = createRequire(import.meta.url);
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const leggi = (f) => fs.readFileSync(path.join(radice, f), 'utf8');
const vietato = (cosa) => () => { throw new Error(`test: ${cosa} is not allowed in tests`); };

const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-mcp-luce-'));
let codiceUscita = 1;
const caricaOriginale = Module._load;
const erroriOriginali = console.error;
try {
    console.log('\n--- il server vero: chi conta come contatto ---');
    const pacchetto = path.join(cartella, 'mcp-server.cjs');
    await esbuild.build({
        entryPoints: [path.join(radice, 'electron/mcp-server.src.mjs')],
        outfile: pacchetto, bundle: true, platform: 'node', format: 'cjs', target: 'node20', logLevel: 'silent',
    });
    const { avviaServerMcp } = require(pacchetto);
    const CODICE = 'c'.repeat(32);
    let contatti = 0;
    const server = await avviaServerMcp({ porta: 0, codice: CODICE, chiedi: async () => ({ risultato: [] }), versione: '2.0.3', contatto: () => { contatti++; } });
    const grezza = (metodo, intestazioni) => new Promise((risolvi) => {
        const req = http.request({ host: '127.0.0.1', port: server.porta, path: '/images-tag-manager', method: metodo, headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...intestazioni } }, (res) => {
            res.resume();
            res.on('end', () => risolvi(res.statusCode));
        });
        req.on('error', () => risolvi('errore'));
        req.end(metodo === 'POST' ? JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) : undefined);
    });
    dice('senza codice: respinto e NON conta come contatto', [401, 0], [await grezza('POST', {}), contatti]);
    dice('codice sbagliato: respinto e NON conta', [401, 0], [await grezza('POST', { Authorization: 'Bearer ' + 'd'.repeat(32) }), contatti]);
    dice('pagina web (Origin non locale) col codice giusto: respinta e NON conta', [403, 0], [await grezza('POST', { Authorization: `Bearer ${CODICE}`, Origin: 'https://evil.example' }), contatti]);
    dice('GET col codice giusto: 405 e NON conta', [405, 0], [await grezza('GET', { Authorization: `Bearer ${CODICE}` }), contatti]);
    const client = new Client({ name: 'prova', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.porta}/images-tag-manager`), { requestInit: { headers: { Authorization: `Bearer ${CODICE}` } } }));
    dice('un client MCP vero col codice giusto: appena si presenta conta come contatto', true, contatti > 0);
    await client.close();
    await server.chiudi();

    console.log('\n--- main.cjs: ultimo contatto, azzerato spegnendo o rinnovando il codice ---');
    const handlers = new Map();
    const avvii = [];
    const serverFinto = {
        avviaServerMcp: async (opzioni) => { avvii.push(opzioni); return { porta: 37620, chiudi: async () => {} }; },
    };
    const electronFinto = {
        app: {
            isPackaged: true, getLocale: () => 'en-US', getVersion: () => '0.0.0',
            getPath: () => cartella,
            requestSingleInstanceLock: () => true, quit() {}, on() {},
            whenReady: () => new Promise(() => {}),
        },
        BrowserWindow: class { constructor() { throw new Error('test: no window in tests'); } static getAllWindows() { return []; } },
        ipcMain: { handle: (canale, fn) => handlers.set(canale, fn), on() {} },
        net: { request: vietato('the network') },
        safeStorage: { isEncryptionAvailable: () => false, encryptString: vietato('safeStorage'), decryptString: vietato('safeStorage') },
        session: { defaultSession: {} },
        Menu: { setApplicationMenu() {} },
        shell: { trashItem: vietato('the Recycle Bin'), openExternal: vietato('opening addresses') },
    };
    const cpFinto = { ...require('node:child_process'), spawn: vietato('starting programs'), exec: vietato('starting programs'), execFile: vietato('starting programs') };
    Module._load = function (richiesta, ...resto) {
        if (richiesta === 'electron') return electronFinto;
        if (richiesta === 'child_process' || richiesta === 'node:child_process') return cpFinto;
        if (richiesta === './mcp-server.cjs') return serverFinto;
        return caricaOriginale.call(this, richiesta, ...resto);
    };
    console.error = () => {};
    require(path.join(radice, 'electron', 'main.cjs'));
    const stato = () => handlers.get('mcp:get-status')();

    const acceso = await handlers.get('mcp:set-enabled')({}, true);
    dice('appena acceso: attivo, nessun contatto (0)', [true, 0], [acceso.attivo, acceso.ultimoContatto]);
    dice('main.cjs passa al server la funzione del contatto', 'function', typeof avvii.at(-1).contatto);
    const primoServer = avvii.at(-1).contatto;
    const prima = Date.now();
    primoServer();
    const dopo = (await stato()).ultimoContatto;
    dice('dopo il primo contatto c\'e\' l\'ora del contatto', true, dopo >= prima && dopo <= Date.now());

    const rinnovato = await handlers.get('mcp:new-token')();
    dice('codice nuovo: il contatto si azzera (le AI col codice vecchio sono fuori)', [true, 0], [rinnovato.attivo, rinnovato.ultimoContatto]);
    primoServer();
    dice('un contatto arrivato dal server vecchio non conta', 0, (await stato()).ultimoContatto);
    avvii.at(-1).contatto();
    dice('il server nuovo invece conta', true, (await stato()).ultimoContatto > 0);

    const secondoServer = avvii.at(-1).contatto;
    const spento = await handlers.get('mcp:set-enabled')({}, false);
    dice('spento: contatto azzerato', [false, 0], [spento.attivo, spento.ultimoContatto]);
    secondoServer();
    dice('un contatto arrivato dopo lo spegnimento non conta', 0, (await stato()).ultimoContatto);
    Module._load = caricaOriginale;
    console.error = erroriOriginali;

    console.log('\n--- main.cjs e preload: la finestra viene avvisata ---');
    const main = leggi('electron/main.cjs');
    dice('al contatto main.cjs manda lo stato nuovo alla finestra (mcp:status)', true, /webContents\.send\('mcp:status', statoMcp\(\)\)/.test(main));
    // ITALIANO: il ritmo degli avvisi si prova davvero: si esegue il pezzo di main.cjs con un orologio e una
    //           finestra finti. Il conto deve partire dall'ultimo AVVISO: contandolo dall'ultimo contatto, un'AI
    //           che chiama ogni 10 s non avviserebbe mai piu' e l'ora mostrata resterebbe quella del primo contatto.
    // ENGLISH: the notice pace is really tested: the main.cjs piece runs with a fake clock and window. The count
    //          must start from the last NOTICE: counted from the last contact, an AI calling every 10 s would never
    //          notify again and the time shown would stay the one of the first contact.
    const pezzo = main.slice(main.indexOf('let mcpUltimoContatto = 0;'), main.indexOf('const chiediAllaFinestra'));
    const finto = new Function('Date', 'mainWindow', 'statoMcp',
        pezzo + '\nreturn { segna: segnaContattoMcp, azzera: () => { mcpGiro++; mcpUltimoContatto = 0; mcpUltimoAvviso = 0; }, giro: () => mcpGiro };');
    let adesso = 1000000;
    const avvisi = [];
    const giro = finto({ now: () => adesso }, { isDestroyed: () => false, webContents: { send: (c) => avvisi.push(c) } }, () => ({}));
    const chiamaA = (ms) => { adesso = 1000000 + ms; giro.segna(giro.giro()); return avvisi.length; };
    dice('primo contatto: la finestra viene avvisata subito', 1, chiamaA(0));
    dice('contatti a 10 e 20 s: nessun avviso in piu\'', 1, (chiamaA(10000), chiamaA(20000)));
    dice('a 31 s, con l\'AI che non ha mai smesso: nuovo avviso (l\'ora si aggiorna)', 2, chiamaA(31000));
    dice('a 50 s no, a 62 s si\'', [2, 3], [chiamaA(50000), chiamaA(62000)]);
    giro.azzera();
    dice('dopo uno spegnimento o un codice nuovo il primo contatto avvisa subito', 4, chiamaA(63000));
    dice('...e fermaMcp azzera anche l\'ultimo avviso', true, /mcpUltimoContatto = 0;\s*mcpUltimoAvviso = 0;/.test(main.slice(main.indexOf('const fermaMcp'))));
    const preload = leggi('electron/preload.cjs');
    dice('il preload passa alla pagina solo lo stato (onStatus su mcp:status)', true, /onStatus: \(cb\) => \{[\s\S]*?ipcRenderer\.on\('mcp:status', ascolta\)[\s\S]*?removeListener\('mcp:status', ascolta\)/.test(preload));

    console.log('\n--- la pagina ---');
    const app = leggi('src/App.tsx');
    dice('la pagina ascolta lo stato nuovo e smette all\'uscita', true, /const smettiStato = api\.onStatus\?\.\(\(s\) => setMcpStato\(s\)\)/.test(app) && /smettiStato\(\);/.test(app));
    const riga = (app.match(/const stato = mcpStato\.errore === 'porta'[^\n]*/) || [''])[0];
    dice('ordine degli stati: guasto, partenza, lavoro, attesa (nessun contatto), ascolto', true,
        /'errore' : !mcpStato\.attivo \? 'partenza' : mcpAlLavoro \? 'lavoro' : !mcpStato\.ultimoContatto \? 'attesa' : 'ascolto'/.test(riga));
    dice('attesa = pallino rosso, ascolto = verde', true, /attesa: 'bg-red-500/.test(app) && /ascolto: 'bg-emerald-500/.test(app));
    dice('il guasto si distingue: triangolo al posto del pallino', true, /stato === 'errore'\s*\?\s*<AlertTriangle/.test(app));
    dice('la finestrella dice "nessuna AI" o l\'ora dell\'ultimo contatto', true, /t\.mcpLastContact\.replace\('\{ora\}'/.test(app) && /data-mcp-contatto="nessuno"[^>]*>\{t\.mcpNoAiYet\}/.test(app));
    dice('"nessuna AI" dice di copiare un comando e darlo all\'AI (i pulsanti copiano soltanto)', true, /mcpNoAiYet: "No AI has connected yet\. Copy the command or configuration below and give it to your AI/.test(leggi('src/constants.ts')));

    console.log('\n--- i testi ---');
    const costanti = leggi('src/constants.ts');
    for (const chiave of ['mcpLightWaiting', 'mcpNoAiYet', 'mcpLastContact']) {
        dice(`${chiave} in nove lingue`, 9, (costanti.match(new RegExp(`^\\s*${chiave}: "`, 'gm')) || []).length);
    }
    dice('mcpLastContact ha {ora} in tutte e nove', 9, (costanti.match(/^\s*mcpLastContact: "[^"\n]*\{ora\}/gm) || []).length);
    dice('il verde non dice piu\' solo "in ascolto": dice che un\'AI si e\' gia\' collegata (en)', true, /mcpLightOn: "MCP server on: an AI has connected/.test(costanti));
    codiceUscita = esito();
} finally {
    Module._load = caricaOriginale;
    console.error = erroriOriginali;
    fs.rmSync(cartella, { recursive: true, force: true });
}
process.exit(codiceUscita);
