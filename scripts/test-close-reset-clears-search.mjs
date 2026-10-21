/* ITALIANO: PROVA: "CHIUDI PROGETTO" E "RESET" SVUOTANO LE CASELLE DI RICERCA
   La conferma di Chiudi progetto dice che l'app torna come appena aperta, ma la ricerca per tag della
   barra ("Cerca per tag...") restava scritta: la cartella aperta dopo compariva filtrata, anche vuota
   ("0 / 40"), senza un messaggio. Lo stesso col Reset, e per la ricerca del pannello in blocco.
   Si eseguono i testi VERI di closeProjectNow e handleResetProject presi da src/App.tsx.
   Caso vicino che non deve cambiare: aggiungere una cartella a un progetto aperto (confermaImport)
   non tocca la ricerca.
   Uso:  node scripts/test-close-reset-clears-search.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: "CLOSE PROJECT" AND "RESET" EMPTY THE SEARCH BOXES
   The Close project confirmation says the app goes back to just opened, but the toolbar tag search
   ("Search by tag...") stayed typed in: the folder opened next showed filtered, even empty ("0 / 40"),
   with no message. The same with Reset, and for the bulk panel search.
   The REAL text of closeProjectNow and handleResetProject taken from src/App.tsx is run.
   Neighbouring case that must not change: adding a folder to an open project (confermaImport) does
   not touch the search.
   Usage:  node scripts/test-close-reset-clears-search.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const ritaglia = (intestazione) => {
    const inizio = sorgente.indexOf(intestazione);
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (!fine) { console.log('NO  non trovato in src/App.tsx: ' + intestazione.trim()); process.exit(1); }
    return sorgente.slice(inizio, fine.index + fine[0].length);
};

let guai = 0, fatti = 0;
const dice = (nome, atteso, avuto) => {
    fatti++;
    const ok = JSON.stringify(atteso) === JSON.stringify(avuto);
    if (!ok) guai++;
    console.log(`${ok ? 'OK ' : 'NO '} ${nome}${ok ? '' : `\n     atteso: ${JSON.stringify(atteso)}\n     avuto:  ${JSON.stringify(avuto)}`}`);
};

const js = (await esbuild.transform(ritaglia('    const closeProjectNow = ') + ritaglia('    const handleResetProject = '), { loader: 'ts' })).code;
const NOMI = ['progettoGenRef', 'aiCancelRequestedRef', 'setAiCancelRequested', 'aiAbortControllerRef', 'localStorage', 'backupDopoChiusura',
    'imagesRef', 'fotoChiuseRef', 'releaseThumbnails', 'images', 'liberaAnteprimeProgetto', 'ultimoSvuotamento', 'setUltimoSvuotamento',
    'setImages', 'setGlobalTriggers', 'setSelectedForBulk', 'setStagedBulkTags', 'setCustomProjectTags', 'setDirHandle', 'setSelectedImageId',
    'setCopiedTags', 'setHistory', 'setHistoryIndex', 'discoNotoRef', 'soundManager', 'showNotification', 't', 'setConfirmDialog',
    'setTagSearch', 'setBulkSearch'];
const fabbrica = new Function(...NOMI, js + '\nreturn { closeProjectNow, handleResetProject };');

// ITALIANO: l'app finta: ogni setter annota l'ultimo valore; le ricerche partono scritte.
// ENGLISH: the fake app: every setter records its last value; the searches start typed in.
const app = () => {
    const stato = { tagSearch: 'smile', bulkSearch: 'hair', dialogo: null };
    const nulla = () => { };
    const finti = {
        progettoGenRef: { current: 0 }, aiCancelRequestedRef: { current: false }, aiAbortControllerRef: { current: null },
        localStorage: { getItem: () => null, setItem: nulla, removeItem: nulla }, backupDopoChiusura: nulla,
        imagesRef: { current: [] }, fotoChiuseRef: { current: new Map() }, releaseThumbnails: nulla, images: [],
        liberaAnteprimeProgetto: nulla, ultimoSvuotamento: null, discoNotoRef: { current: new Map() },
        soundManager: { chime() { }, pop() { } }, showNotification: nulla, t: {},
        setConfirmDialog: (d) => { stato.dialogo = d; },
        setTagSearch: (v) => { stato.tagSearch = v; }, setBulkSearch: (v) => { stato.bulkSearch = v; },
    };
    const f = fabbrica(...NOMI.map(n => (n in finti ? finti[n] : nulla)));
    return { stato, ...f };
};

{
    const a = app();
    a.closeProjectNow();
    dice('Chiudi progetto: la ricerca per tag della barra e\' vuota', '', a.stato.tagSearch);
    dice('...e anche quella del pannello in blocco', '', a.stato.bulkSearch);
}
{
    const a = app();
    a.handleResetProject();
    dice('Reset, prima della conferma: la ricerca resta', 'smile', a.stato.tagSearch);
    a.stato.dialogo.onCancel();
    dice('Reset annullato: la ricerca resta', 'smile', a.stato.tagSearch);
    a.handleResetProject();
    a.stato.dialogo.onConfirm();
    dice('Reset confermato: la ricerca per tag della barra e\' vuota', '', a.stato.tagSearch);
    dice('...e anche quella del pannello in blocco', '', a.stato.bulkSearch);
}
// ITALIANO: caso vicino: aggiungere una cartella al progetto aperto lascia la ricerca com'e'.
// ENGLISH: neighbouring case: adding a folder to the open project leaves the search as it is.
dice('confermaImport non tocca la ricerca', false, /setTagSearch|setBulkSearch/.test(ritaglia('    const confermaImport = ')));

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
