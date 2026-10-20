/* ITALIANO: PROVA DEL PONTE TRA PAGINA E PROCESSO PRINCIPALE (electron/preload.cjs)
   preload.cjs e' l'UNICA cosa che la pagina vede del sistema (window.electronAPI), ma nessun
   controllo lo caricava: tsc legge solo src/, e npm test non lo apriva. Con una virgola tolta o
   un nome di canale scritto male la costruzione andava avanti verde, e il programma pubblicato
   partiva senza electronAPI (niente Cestino, niente .txt dal processo principale, niente chiave).
   Qui si carica il preload VERO con un 'electron' finto, si chiama ogni metodo esposto e si
   pretende che: il caricamento non dia errori; il nome sia electronAPI; ogni canale chiamato sia
   uno di quelli che main.cjs registra davvero (caricato con main-harness) e viceversa; ogni
   metodo usi il SUO canale e passi i suoi argomenti (tabella ATTESI); i metodi restituiscano la risposta del canale; le chiavi esposte siano quelle dichiarate in
   src/electron.d.ts; ipcRenderer non passi intero alla pagina. Niente finestre, niente rete.
   Uso:  node scripts/test-preload-bridge.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE BRIDGE BETWEEN PAGE AND MAIN PROCESS (electron/preload.cjs)
   preload.cjs is the ONLY thing the page sees of the system (window.electronAPI), but no check
   loaded it: tsc reads only src/, and npm test never opened it. With a comma dropped or a channel
   name mistyped the build went on green, and the published app started without electronAPI (no
   Recycle Bin, no .txt through the main process, no key). Here the REAL preload is loaded with a
   fake 'electron', every exposed method is called, and the test requires that: loading throws
   nothing; the name is electronAPI; every channel called is one main.cjs really registers
   (loaded through main-harness) and vice versa; every method uses ITS channel and forwards its
   arguments (table ATTESI); the methods return the channel's answer; the
   exposed keys are the ones declared in src/electron.d.ts; ipcRenderer is not handed to the page
   whole. No window, no network.
   Usage:  node scripts/test-preload-bridge.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { caricaMain, creaControlli } from './main-harness.mjs';

const require = createRequire(import.meta.url);
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

// ITALIANO: l'electron finto del preload: annota cosa viene esposto, quali canali vengono chiamati
//           e con quali argomenti.
// ENGLISH: the preload's fake electron: records what gets exposed, which channels get called
//          and with which arguments.
const esposti = [];
const canaliChiamati = [];
const argomentiChiamati = [];
const risposta = (canale) => ({ rispostaDi: canale });
// ITALIANO: send/on/removeListener servono solo al server MCP, e solo sui suoi due canali.
// ENGLISH: send/on/removeListener are only for the MCP server, and only on its two channels.
const inviati = [];
const ascolti = [];
const tolti = [];
const ipcRenderer = {
    invoke: (canale, ...argomenti) => { canaliChiamati.push(canale); argomentiChiamati.push(argomenti); return risposta(canale); },
    send: (canale, ...argomenti) => {
        if (canale !== 'mcp:response') throw new Error('test-preload-bridge: ipcRenderer.send is only expected on mcp:response');
        inviati.push({ canale, argomenti });
    },
    on: (canale, fn) => {
        if (canale !== 'mcp:request') throw new Error('test-preload-bridge: ipcRenderer.on is only expected on mcp:request');
        ascolti.push({ canale, fn });
    },
    removeListener: (canale, fn) => { tolti.push({ canale, fn }); },
};
const electronFinto = {
    contextBridge: { exposeInMainWorld: (nome, oggetto) => esposti.push({ nome, oggetto }) },
    ipcRenderer,
    webUtils: { getPathForFile: () => 'C:\\finto\\foto.png' },
};

let erroreCaricamento = null;
const caricaOriginale = Module._load;
Module._load = function (richiesta, ...resto) {
    if (richiesta === 'electron') return electronFinto;
    return caricaOriginale.call(this, richiesta, ...resto);
};
try {
    require(path.join(radice, 'electron', 'preload.cjs'));
} catch (e) {
    erroreCaricamento = `${e && e.name}: ${e && e.message}`;
} finally {
    Module._load = caricaOriginale;
}
dice('il preload si carica senza errori (sintassi compresa)', null, erroreCaricamento);
dice('il preload espone un solo oggetto, di nome electronAPI', ['electronAPI'], esposti.map((x) => x.nome));
const api = (esposti[0] && esposti[0].oggetto) || {};

// ITALIANO: chiama ogni funzione esposta (anche quelle dentro secureStorage) con argomenti finti,
//           e annota quale canale ha usato e cosa ha restituito.
// ENGLISH: calls every exposed function (also those inside secureStorage) with fake arguments,
//          and records which channel it used and what it returned.
const metodi = [];
const visita = (oggetto, prefisso) => {
    for (const [nome, valore] of Object.entries(oggetto)) {
        const chiave = prefisso + nome;
        if (typeof valore === 'function') metodi.push({ chiave, fn: valore });
        else if (valore && typeof valore === 'object') visita(valore, chiave + '.');
    }
};
visita(api, '');
dice('premessa: il preload espone almeno 12 metodi', true, metodi.length >= 12);
const esitoDi = new Map();
for (const { chiave, fn } of metodi) {
    const prima = canaliChiamati.length;
    let avuto;
    try { avuto = fn('a', 'b'); } catch (e) { avuto = { errore: String(e && e.message) }; }
    esitoDi.set(chiave, { canali: canaliChiamati.slice(prima), argomenti: argomentiChiamati.slice(prima), avuto });
}

// ITALIANO: i canali che main.cjs registra davvero (main.cjs vero, electron finto).
// ENGLISH: the channels main.cjs really registers (real main.cjs, fake electron).
const registrati = [...caricaMain().handlers.keys()].sort();
dice('premessa: main.cjs registra almeno 12 canali', true, registrati.length >= 12);
const chiamati = [...new Set(canaliChiamati)].sort();
dice('ogni canale chiamato dal preload e\' registrato in main.cjs', [], chiamati.filter((c) => !registrati.includes(c)));
dice('ogni canale registrato in main.cjs e\' raggiungibile dal preload', [], registrati.filter((c) => !chiamati.includes(c)));

// ITALIANO: un metodo che usa un canale ne restituisce la risposta (senza, la pagina riceverebbe
//           undefined); getPathForFile e' l'unico che non passa da un canale.
// ENGLISH: a method that uses a channel returns its answer (otherwise the page would get
//          undefined); getPathForFile is the only one that does not go through a channel.
const SENZA_INVOKE = ['getPathForFile', 'mcp.onRequest', 'mcp.respond'];
for (const [chiave, { canali, avuto }] of esitoDi) {
    if (chiave === 'mcp.onRequest' || chiave === 'mcp.respond') continue;
    if (chiave === 'getPathForFile') {
        dice('getPathForFile usa webUtils e nessun canale', [[], 'C:\\finto\\foto.png'], [canali, avuto]);
        continue;
    }
    dice(`${chiave} usa un solo canale e ne restituisce la risposta`, true, canali.length === 1 && JSON.stringify(avuto) === JSON.stringify(risposta(canali[0])));
}

// ITALIANO: il confronto fra insiemi di canali qui sopra non vede due metodi coi canali scambiati
//           (Svuota cestino che chiama il ripristino) ne' un argomento perso (Salva che manda
//           undefined). Per questo ogni metodo ha il SUO canale e gli argomenti che deve passare.
//           I metodi sono chiamati con ('a', 'b'): String('a') resta 'a'. Un metodo nuovo va
//           aggiunto a questa tabella, altrimenti la prova diventa rossa (voluto).
// ENGLISH: the channel-set comparison above cannot see two methods with swapped channels (Empty
//          Trash calling the restore) nor a dropped argument (Save sending undefined). So every
//          method has ITS channel and the arguments it must forward. Methods are called with
//          ('a', 'b'): String('a') stays 'a'. A new method must be added to this table, otherwise
//          the test turns red (on purpose).
const ATTESI = {
    getAppVersion: ['app:get-version', []],
    persistLang: ['app:persist-lang', ['a']],
    readCrashBackup: ['backup:read', []],
    writeCrashBackup: ['backup:write', ['a']],
    'secureStorage.get': ['secure-storage:get', ['a']],
    'secureStorage.set': ['secure-storage:set', ['a', 'b']],
    'secureStorage.delete': ['secure-storage:delete', ['a']],
    readSidecarTags: ['images:read-sidecar-tags', ['a']],
    writeSidecarTags: ['images:write-sidecar-tags', ['a']],
    trashFiles: ['shell:trash-files', ['a']],
    restoreTrashed: ['shell:restore-trashed', ['a']],
    beginFolderPick: ['folder:begin-pick', []],
    takePickedFolderPath: ['folder:take-picked-dir', ['a']],
    openExternal: ['shell:open-external', ['a']],
    checkForUpdate: ['updates:check', []],
    'mcp.getStatus': ['mcp:get-status', []],
    'mcp.setEnabled': ['mcp:set-enabled', [false]],
    'mcp.newToken': ['mcp:new-token', []],
};
dice('la tabella dei canali copre esattamente i metodi che usano un canale',
    Object.keys(ATTESI).sort(), [...esitoDi.keys()].filter((k) => !SENZA_INVOKE.includes(k)).sort());
for (const [chiave, { canali, argomenti }] of esitoDi) {
    if (!ATTESI[chiave]) continue;
    const [canale, argomentiAttesi] = ATTESI[chiave];
    dice(`${chiave} usa il canale ${canale} e passa ${JSON.stringify(argomentiAttesi)}`,
        [[canale], [argomentiAttesi]], [canali, argomenti]);
}

// ITALIANO: le chiavi esposte sono esattamente quelle dichiarate in src/electron.d.ts.
// ENGLISH: the exposed keys are exactly the ones declared in src/electron.d.ts.
const tipi = fs.readFileSync(path.join(radice, 'src', 'electron.d.ts'), 'utf8').replace(/\r\n/g, '\n');
const membri = (interfaccia) => {
    const m = tipi.match(new RegExp(`export interface ${interfaccia} \\{\\n([\\s\\S]*?)\\n\\}`));
    return m ? [...m[1].matchAll(/^ {4}(\w+)\??:/gm)].map((x) => x[1]).sort() : [];
};
dice('premessa: trovati i membri di ElectronAPI in src/electron.d.ts', true, membri('ElectronAPI').length >= 12);
dice('electronAPI ha esattamente le chiavi di ElectronAPI', membri('ElectronAPI'), Object.keys(api).sort());
dice('secureStorage ha esattamente le chiavi di ElectronSecureStorage', membri('ElectronSecureStorage'), Object.keys(api.secureStorage || {}).sort());
dice('isElectron vale true', true, api.isElectron);
dice('mcp ha esattamente le chiavi di ElectronMcp', membri('ElectronMcp'), Object.keys(api.mcp || {}).sort());

// ITALIANO: il server MCP: le domande arrivano su 'mcp:request' e la pagina riceve SOLO la domanda
//           (non l'evento di Electron); la funzione restituita smette di ascoltare la STESSA
//           funzione; la risposta parte su 'mcp:response' con id e contenuto.
// ENGLISH: the MCP server: questions arrive on 'mcp:request' and the page gets ONLY the question
//          (not Electron's event); the returned function stops listening to the SAME function; the
//          answer leaves on 'mcp:response' with id and content.
{
    const ricevute = [];
    ascolti.length = 0; tolti.length = 0; inviati.length = 0;
    const smetti = api.mcp.onRequest((r) => ricevute.push(r));
    dice('mcp.onRequest ascolta il canale mcp:request', ['mcp:request'], ascolti.map((a) => a.canale));
    ascolti[0] && ascolti[0].fn({ sender: 'evento' }, { id: 7, strumento: 'list_photos', argomenti: {} });
    dice('...e alla pagina arriva la domanda, non l\'evento',[{ id: 7, strumento: 'list_photos', argomenti: {} }], ricevute);
    dice('...e restituisce una funzione per smettere', 'function', typeof smetti);
    smetti();
    dice('...che toglie lo stesso ascolto', true, tolti.length === 1 && tolti[0].canale === 'mcp:request' && tolti[0].fn === (ascolti[0] && ascolti[0].fn));
    api.mcp.respond(7, { risultato: 1 });
    dice('mcp.respond manda id e risposta su mcp:response', [{ canale: 'mcp:response', argomenti: [{ id: 7, risposta: { risultato: 1 } }] }], inviati);
}

// ITALIANO: la pagina non deve ricevere ipcRenderer (o i suoi metodi) per intero.
// ENGLISH: the page must not receive ipcRenderer (or its methods) whole.
const valori = [];
const raccogli = (o) => { for (const v of Object.values(o)) { valori.push(v); if (v && typeof v === 'object') raccogli(v); } };
raccogli(api);
dice('nessun valore esposto e\' ipcRenderer o un suo metodo', false, valori.some((v) => v === ipcRenderer || Object.values(ipcRenderer).includes(v)));

process.exit(esito());
