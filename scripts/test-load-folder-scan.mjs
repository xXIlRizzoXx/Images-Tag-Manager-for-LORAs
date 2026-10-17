/* ITALIANO: PROVA DI "Carica cartella" CON UNA VOCE ILLEGGIBILE
   Una sola voce che non si lasciava leggere (un file sparito fra l'elenco e la lettura, una
   sottocartella che non si lascia elencare, un disco di rete che singhiozza) faceva fallire
   tutta la scansione: non si importava niente, nessun messaggio, e il programma cliccava da solo
   il campo nascosto del ripiego, cioe' un SECONDO selettore di cartelle pensato per il browser di
   prova. Ora la voce si salta e si dice quante; se non si legge la cartella scelta stessa, un
   messaggio lo dice; il secondo selettore resta solo per quando e' il selettore a non funzionare.
   Si esegue il testo VERO di handleLoadFolderClick preso da src/App.tsx (compilato con esbuild),
   con la scansione vera di src/utils/folderScan.ts, i testi veri di src/constants.ts e cartelle
   FINTE in memoria: nessun selettore si apre, nessun disco viene letto.
   Uso:  node scripts/test-load-folder-scan.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "Load folder" WITH AN UNREADABLE ENTRY
   A single entry that could not be read (a file gone between the listing and the read, a
   subfolder that refuses to be listed, a flaky network drive) made the whole scan fail: nothing
   was imported, no message, and the program clicked the fallback's hidden input by itself, i.e.
   a SECOND folder picker meant for the test browser. Now the entry is skipped and the count is
   shown; if the picked folder itself cannot be read, a message says so; the second picker stays
   only for when the picker itself does not work.
   The REAL text of handleLoadFolderClick taken from src/App.tsx is run (compiled with esbuild),
   with the real scan of src/utils/folderScan.ts, the real strings of src/constants.ts and FAKE
   in-memory folders: no picker opens, no disk is read.
   Usage:  node scripts/test-load-folder-scan.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const { scanDirectoryHandle } = await carica('src/utils/folderScan.ts');
const t = (await carica('src/constants.ts')).translations.en;
const { dice, esito } = creaControlli();
const testo = (chiave, n) => typeof t[chiave] === 'string' ? t[chiave].replace('{n}', String(n)) : `(manca la chiave ${chiave})`;

// ITALIANO: il gestore vero, ritagliato dal sorgente fra il suo inizio e quello successivo.
// ENGLISH: the real handler, cut out of the source between its start and the next one.
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
// ITALIANO: dalla funzione condivisa importaCartellaScelta, che sta subito prima e che il gestore chiama.
// ENGLISH: from the shared importaCartellaScelta, which sits right before and which the handler calls.
const inizio = sorgente.indexOf('    const importaCartellaScelta = async (');
const fine = sorgente.indexOf('    const handleFolderUploadFallback');
if (inizio < 0 || fine < inizio) {
    console.log('NO  handleLoadFolderClick non trovato in src/App.tsx');
    process.exit(1);
}
const js = (await esbuild.transform(sorgente.slice(inizio, fine), { loader: 'ts' })).code;
const fabbrica = new Function('window', 't', 'showNotification', 'calculateImportSummary', 'folderInputRef', 'scanDirectoryHandle',
    js + '\nreturn handleLoadFolderClick;');

// ITALIANO: gli avvisi in console della scansione sono ATTESI: si mettono da parte.
// ENGLISH: the scan's console warnings are EXPECTED: set them aside.
console.warn = () => {};
console.error = () => {};

// --- cartelle finte della File System Access API
const errore = (nome) => Object.assign(new Error(nome), { name: nome });
const file = (name, type) => ({ name, type, size: 10, lastModified: 1 });
const voceFile = (f, rotto) => ({ kind: 'file', name: f.name, getFile: async () => { if (rotto) throw errore(rotto); return f; } });
const voceCartella = (name, voci, rotto) => ({
    kind: 'directory', name,
    values() {
        let i = 0;
        return {
            [Symbol.asyncIterator]() { return this; },
            async next() {
                if (rotto) throw errore(rotto);
                return i < voci.length ? { value: voci[i++], done: false } : { value: undefined, done: true };
            },
        };
    },
});

const prova = async (selettore) => {
    const r = { importate: null, notifiche: [], clic: 0, ritiri: [] };
    const window = {
        showDirectoryPicker: selettore,
        electronAPI: {
            beginFolderPick: async () => {},
            takePickedFolderPath: async (prove) => { r.ritiri.push(prove.length); return ''; },
        },
    };
    const fn = fabbrica(window, t, (m, tipo) => r.notifiche.push([m, tipo]),
        (img, txt) => { r.importate = { img: img.map(f => f.name), txt: txt.map(f => f.name) }; },
        { current: { click: () => { r.clic++; } } }, scanDirectoryHandle);
    await fn();
    return r;
};
const a = file('a.jpg', 'image/jpeg');
const b = file('b.png', 'image/png');
const at = file('a.txt', 'text/plain');

console.log('\n--- una sottocartella che non si lascia elencare ---');
{
    const r = await prova(async () => voceCartella('dataset', [voceFile(a), voceFile(at), voceCartella('bloccata', [], 'NotAllowedError'), voceFile(b)]));
    dice('le foto leggibili si importano', { img: ['a.jpg', 'b.png'], txt: ['a.txt'] }, r.importate);
    dice('nessun secondo selettore', 0, r.clic);
    dice('si dice quante voci sono state saltate', [[testo('folderEntriesSkipped', 1), 'info']], r.notifiche);
}

console.log('\n--- un file sparito fra l\'elenco e la lettura ---');
{
    const r = await prova(async () => voceCartella('dataset', [voceFile(a), voceFile(at), voceFile(file('~tmp.jpg', 'image/jpeg'), 'NotFoundError'), voceCartella('10_sub', [voceFile(b)])]));
    dice('le foto leggibili si importano, anche nella sottocartella', { img: ['a.jpg', 'b.png'], txt: ['a.txt'] }, r.importate);
    dice('nessun secondo selettore', 0, r.clic);
    dice('si dice quante voci sono state saltate', [[testo('folderEntriesSkipped', 1), 'info']], r.notifiche);
}

console.log('\n--- nessuna immagine arrivata, ma una sottocartella non si e\' letta ---');
{
    const r = await prova(async () => voceCartella('dataset', [voceFile(at), voceCartella('10_sub', [], 'NotAllowedError')]));
    dice('niente import, nessun secondo selettore', [null, 0], [r.importate, r.clic]);
    dice('si dice che non e\' arrivata nessuna immagine E quante voci sono state saltate', [[t.noImagesTitle + ' ' + testo('folderEntriesSkipped', 1), 'info']], r.notifiche);
}

console.log('\n--- la cartella scelta stessa non si legge ---');
{
    const r = await prova(async () => voceCartella('dataset', [], 'NotAllowedError'));
    dice('niente import', null, r.importate);
    dice('nessun secondo selettore', 0, r.clic);
    dice('un messaggio lo dice', [[testo('folderReadError'), 'error']], r.notifiche);
    dice('la registrazione del percorso nel processo principale si chiude', [0], r.ritiri);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const pulita = await prova(async () => voceCartella('dataset', [voceFile(a), voceFile(at), voceCartella('10_sub', [voceFile(b)])]));
    dice('cartella pulita: si importa tutto', { img: ['a.jpg', 'b.png'], txt: ['a.txt'] }, pulita.importate);
    dice('...senza messaggi e senza secondo selettore', [[], 0], [pulita.notifiche, pulita.clic]);
    const vuota = await prova(async () => voceCartella('dataset', [voceFile(at)]));
    dice('cartella senza immagini: "No images imported."', [null, [[t.noImagesTitle, 'info']], 0], [vuota.importate, vuota.notifiche, vuota.clic]);
    const iframe = await prova(async () => { throw errore('SecurityError'); });
    dice('il selettore stesso e\' bloccato (browser di prova): si usa il ripiego', 1, iframe.clic);
    dice('...senza import e senza messaggi', [null, []], [iframe.importate, iframe.notifiche]);
    dice('...e la registrazione del percorso si chiude', [0], iframe.ritiri);
    const annullato = await prova(async () => { throw errore('AbortError'); });
    dice('scelta annullata: niente di niente', [null, [], 0], [annullato.importate, annullato.notifiche, annullato.clic]);
}

process.exit(esito());
