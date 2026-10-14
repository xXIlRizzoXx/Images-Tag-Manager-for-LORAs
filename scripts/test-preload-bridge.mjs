/* ITALIANO: PROVA DEL PONTE TRA PAGINA E PROCESSO PRINCIPALE (electron/preload.cjs)
   preload.cjs e' l'UNICA cosa che la pagina vede del sistema (window.electronAPI), ma nessun
   controllo lo caricava: tsc legge solo src/, e npm test non lo apriva. Con una virgola tolta o
   un nome di canale scritto male la costruzione andava avanti verde, e il programma pubblicato
   partiva senza electronAPI (niente Cestino, niente .txt dal processo principale, niente chiave).
   Qui si carica il preload VERO con un 'electron' finto, si chiama ogni metodo esposto e si
   pretende che: il caricamento non dia errori; il nome sia electronAPI; ogni canale chiamato sia
   uno di quelli che main.cjs registra davvero (caricato con main-harness) e viceversa; i metodi
   restituiscano la risposta del canale; le chiavi esposte siano quelle dichiarate in
   src/electron.d.ts; ipcRenderer non passi intero alla pagina. Niente finestre, niente rete.
   Uso:  node scripts/test-preload-bridge.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE BRIDGE BETWEEN PAGE AND MAIN PROCESS (electron/preload.cjs)
   preload.cjs is the ONLY thing the page sees of the system (window.electronAPI), but no check
   loaded it: tsc reads only src/, and npm test never opened it. With a comma dropped or a channel
   name mistyped the build went on green, and the published app started without electronAPI (no
   Recycle Bin, no .txt through the main process, no key). Here the REAL preload is loaded with a
   fake 'electron', every exposed method is called, and the test requires that: loading throws
   nothing; the name is electronAPI; every channel called is one main.cjs really registers
   (loaded through main-harness) and vice versa; the methods return the channel's answer; the
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

// ITALIANO: l'electron finto del preload: annota cosa viene esposto e quali canali vengono chiamati.
// ENGLISH: the preload's fake electron: records what gets exposed and which channels get called.
const esposti = [];
const canaliChiamati = [];
const risposta = (canale) => ({ rispostaDi: canale });
const ipcRenderer = {
    invoke: (canale) => { canaliChiamati.push(canale); return risposta(canale); },
    send: () => { throw new Error('test-preload-bridge: ipcRenderer.send is not expected'); },
    on: () => { throw new Error('test-preload-bridge: ipcRenderer.on is not expected'); },
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
    esitoDi.set(chiave, { canali: canaliChiamati.slice(prima), avuto });
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
for (const [chiave, { canali, avuto }] of esitoDi) {
    if (chiave === 'getPathForFile') {
        dice('getPathForFile usa webUtils e nessun canale', [[], 'C:\\finto\\foto.png'], [canali, avuto]);
        continue;
    }
    dice(`${chiave} usa un solo canale e ne restituisce la risposta`, true, canali.length === 1 && JSON.stringify(avuto) === JSON.stringify(risposta(canali[0])));
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

// ITALIANO: la pagina non deve ricevere ipcRenderer (o i suoi metodi) per intero.
// ENGLISH: the page must not receive ipcRenderer (or its methods) whole.
const valori = [];
const raccogli = (o) => { for (const v of Object.values(o)) { valori.push(v); if (v && typeof v === 'object') raccogli(v); } };
raccogli(api);
dice('nessun valore esposto e\' ipcRenderer o un suo metodo', false, valori.some((v) => v === ipcRenderer || Object.values(ipcRenderer).includes(v)));

process.exit(esito());
