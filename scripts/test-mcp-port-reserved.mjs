/* ITALIANO: PROVA DELLA PORTA MCP RISERVATA DA WINDOWS (electron/main.cjs)
   Con Hyper-V, WSL2 o Docker Windows riserva blocchi di porte: se il blocco comprende la porta fissa del
   server MCP, listen fallisce con EACCES. main.cjs trattava come "porta non disponibile" solo EADDRINUSE,
   quindi EACCES diventava 'avvio' e le Impostazioni dicevano "Chiudi e riapri il programma, poi riprova",
   che non serve mai (la porta resta riservata). Ora EACCES e' 'porta' come EADDRINUSE; ogni altro guasto
   resta 'avvio'. Si carica il main.cjs VERO con un Electron finto (nessuna finestra, niente rete), una
   cartella dati temporanea al posto di userData e un server MCP finto che rifiuta con il codice voluto:
   nessuna porta vera viene aperta.
   Uso:  node scripts/test-mcp-port-reserved.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE MCP PORT RESERVED BY WINDOWS (electron/main.cjs)
   With Hyper-V, WSL2 or Docker Windows reserves port blocks: if the block holds the MCP server's fixed
   port, listen fails with EACCES. main.cjs treated only EADDRINUSE as "port not available", so EACCES
   became 'avvio' and Settings said "Close and reopen the program, then try again", which never helps.
   Now EACCES is 'porta' like EADDRINUSE; any other fault stays 'avvio'. The REAL main.cjs is loaded with
   a fake Electron (no window, no network), a temporary data folder instead of userData and a fake MCP
   server that refuses with the chosen code: no real port is opened. */

import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const require = createRequire(import.meta.url);
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const vietato = (cosa) => () => { throw new Error(`test: ${cosa} is not allowed in tests`); };

const cartellaDati = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-mcp-porta-'));
const handlers = new Map();
// ITALIANO: il codice con cui il server finto rifiuta di partire (null = parte).
// ENGLISH: the code the fake server refuses to start with (null = it starts).
let rifiuto = null;
const serverFinto = {
    avviaServerMcp: async () => {
        if (rifiuto === null) return { porta: 37620, chiudi: async () => {} };
        const e = new Error(`listen ${rifiuto || 'failure'} 127.0.0.1:37620`);
        if (rifiuto) e.code = rifiuto;
        throw e;
    },
};
const electronFinto = {
    app: {
        isPackaged: true, getLocale: () => 'en-US', getVersion: () => '0.0.0',
        getPath: () => cartellaDati,
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
const caricaOriginale = Module._load;
// ITALIANO: il server si carica solo quando lo si accende, quindi il finto resta in vigore fino alla fine.
// ENGLISH: the server is loaded only when switched on, so the fake stays in place until the end.
Module._load = function (richiesta, ...resto) {
    if (richiesta === 'electron') return electronFinto;
    if (richiesta === 'child_process' || richiesta === 'node:child_process') return cpFinto;
    if (richiesta === './mcp-server.cjs') return serverFinto;
    return caricaOriginale.call(this, richiesta, ...resto);
};
const erroriOriginali = console.error;
console.error = () => {};
let codice = 1;
try {
    require(path.join(radice, 'electron', 'main.cjs'));
    const accendi = async (codiceErrore) => {
        rifiuto = codiceErrore;
        await handlers.get('mcp:set-enabled')({}, false);
        return handlers.get('mcp:set-enabled')({}, true);
    };

    console.log('\n--- errore di avvio del server MCP ---');
    const ok = await accendi(null);
    dice('premessa: con la porta libera il server parte, nessun errore', [true, true, ''], [ok.acceso, ok.attivo, ok.errore]);
    const riservata = await accendi('EACCES');
    dice('porta riservata da Windows (EACCES): errore "porta", non "chiudi e riapri"', [false, 'porta', 37620], [riservata.attivo, riservata.errore, riservata.porta]);
    const occupata = await accendi('EADDRINUSE');
    dice('porta gia\' usata da un altro programma (EADDRINUSE): errore "porta" come prima', [false, 'porta'], [occupata.attivo, occupata.errore]);
    const altro = await accendi('EINVAL');
    dice('un altro guasto con un codice (EINVAL): resta "avvio"', [false, 'avvio'], [altro.attivo, altro.errore]);
    const senza = await accendi('');
    dice('un guasto senza codice: resta "avvio"', [false, 'avvio'], [senza.attivo, senza.errore]);
    const stato = await handlers.get('mcp:get-status')();
    dice('mcp:get-status ripete l\'ultimo errore', 'avvio', stato.errore);
    const spento = await handlers.get('mcp:set-enabled')({}, false);
    dice('spegnendolo l\'errore sparisce', [false, ''], [spento.acceso, spento.errore]);

    console.log('\n--- il testo mostrato per "porta" ---');
    // ITALIANO: in tutte e nove le lingue il testo dice che la porta puo' essere anche riservata da Windows.
    // ENGLISH: in all nine languages the text says the port may also be reserved by Windows.
    const righe = fs.readFileSync(path.join(radice, 'src', 'constants.ts'), 'utf8').split('\n').filter((r) => /^\s*mcpErrPort:/.test(r));
    dice('mcpErrPort in nove lingue, ognuna col numero della porta e con Windows', [9, 9], [righe.length, righe.filter((r) => r.includes('{porta}') && r.includes('Windows')).length]);
    codice = esito();
} finally {
    Module._load = caricaOriginale;
    console.error = erroriOriginali;
    fs.rmSync(cartellaDati, { recursive: true, force: true });
}
process.exit(codice);
