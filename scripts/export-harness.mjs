/* ITALIANO: BANCO DI PROVA DELL'ESPORTAZIONE .zip (Esporta -> "Solo i tag" / "Tag e immagini")
   Ritaglia da src/App.tsx i testi VERI di formatoPeso, exportAllAsZip, handleExportAll e
   avviaExport, li compila con esbuild e li esegue con i testi veri di src/constants.ts e i moduli
   veri di src/utils. Al posto del disco: una finestra di salvataggio finta che si chiude dopo un
   attimo (come quella vera, che resta aperta finche' l'utente sceglie) e un file di destinazione
   che raccoglie i byte; al posto delle foto: file in memoria che contano chi li legge, quando e
   quanto. Nessuna finestra, nessuna rete, nessun file sul disco.
   Non e' una prova: run-tests.mjs lancia solo i file test-*.mjs.

   ENGLISH: TEST BENCH FOR THE .zip EXPORT (Export -> "Tags only" / "Tags and images")
   Cuts the REAL text of formatoPeso, exportAllAsZip, handleExportAll and avviaExport out of
   src/App.tsx, compiles it with esbuild and runs it with the real strings of src/constants.ts and
   the real src/utils modules. Instead of the disk: a fake save dialog that closes after a moment
   (like the real one, which stays open until the user picks) and a destination file collecting the
   bytes; instead of the photos: in-memory files that count who reads them, when and how much. No
   window, no network, no file on disk.
   Not a test: run-tests.mjs only runs test-*.mjs files. */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const JSZip = createRequire(path.join(radice, 'package.json'))('jszip');

const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
export const lingue = (await carica('src/constants.ts')).translations;
export const t = lingue.en;
const P = await carica('src/utils/pathUtils.ts');
// ITALIANO: la regola delle foto col .txt non letto all'import (l'esportazione le lascia fuori).
// ENGLISH: the rule for photos whose .txt was not read at import (the export leaves them out).
const S = await carica('src/utils/sidecarTags.ts');
// ITALIANO: il modulo nuovo puo' non esserci ancora (codice di prima): allora resta vuoto.
// ENGLISH: the new module may not exist yet (previous code): then it stays empty.
let Z = {};
try { Z = await carica('src/utils/zipWriter.ts'); } catch (_) { Z = {}; }
export const zipWriter = Z;

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
export const sorgenteApp = sorgente;
const ritaglia = async (intestazione) => {
    const inizio = sorgente.indexOf(intestazione);
    if (inizio < 0) return '';
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = inizio;
    const fine = chiusura.exec(sorgente);
    if (!fine) return '';
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
};
const pezzi = {
    formatoPeso: await ritaglia('    const formatoPeso = (byte: number): string => {'),
    exportAllAsZip: await ritaglia('    const exportAllAsZip = async ('),
    handleExportAll: await ritaglia('    const handleExportAll = () => {'),
    avviaExport: await ritaglia('    const avviaExport = ('),
};
for (const k of ['formatoPeso', 'exportAllAsZip', 'handleExportAll']) {
    if (!pezzi[k]) { console.log(`NO  ${k} non trovato in src/App.tsx`); process.exit(1); }
}
export const haAvviaExport = pezzi.avviaExport !== '';

// ITALIANO: l'ordinamento VERO condiviso da galleria ed esportazione (applySort, in cima ad App.tsx,
//           fuori dal componente). creaApp riceve l'ordine scelto in "Ordina per" (sortOrder).
// ENGLISH: the REAL sorting shared by gallery and export (applySort, at the top of App.tsx, outside
//          the component). creaApp receives the order picked in "Sort by" (sortOrder).
const iOrdina = sorgente.indexOf('const applySort = (');
const fOrdina = iOrdina < 0 ? -1 : sorgente.indexOf('\n};', iOrdina);
if (fOrdina < 0) { console.log('NO  applySort non trovato in src/App.tsx'); process.exit(1); }
export const applySort = new Function((await esbuild.transform(sorgente.slice(iOrdina, fOrdina + 3), { loader: 'ts' })).code + '\nreturn applySort;')();

// ITALIANO: il codice di prima leggeva le foto con il FileReader del browser (dentro JSZip), che
//           Node non ha: questo lo imita leggendo con arrayBuffer(), cosi' le foto contano la lettura.
// ENGLISH: the previous code read the photos through the browser's FileReader (inside JSZip), which
//          Node lacks: this mimics it by reading with arrayBuffer(), so the photos count the read.
globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
        blob.arrayBuffer().then(ab => this.onload({ target: { result: ab } }), e => this.onerror({ target: { error: e } }));
    }
};

// ITALIANO: il registro di chi legge cosa: letture in corso, massimo contemporaneo, byte letti e
//           scritti, e la sequenza degli eventi (scelta del file, prima lettura di ogni foto).
// ENGLISH: the log of who reads what: reads in progress, top concurrency, bytes read and written,
//          and the sequence of events (file picked, first read of every photo).
export const creaSonda = () => {
    const s = { inVolo: 0, maxInVolo: 0, letti: 0, scritti: 0, piccoTrattenuto: 0, eventi: [], iniziate: new Set() };
    s.inizio = (nome) => {
        s.inVolo++; s.maxInVolo = Math.max(s.maxInVolo, s.inVolo);
        if (!s.iniziate.has(nome)) { s.iniziate.add(nome); s.eventi.push('lettura ' + nome); }
    };
    s.fine = (n) => { s.inVolo--; s.letti += n; s.piccoTrattenuto = Math.max(s.piccoTrattenuto, s.letti - s.scritti); };
    s.scrittura = (n) => { s.scritti += n; };
    return s;
};

// ITALIANO: una foto in memoria. `rotta` = il file e' cambiato o sparito sul disco dopo l'import:
//           Chromium rifiuta di leggerlo con NotReadableError.
// ENGLISH: an in-memory photo. `rotta` = the file changed or vanished on disk after the import:
//          Chromium refuses to read it with NotReadableError.
export class FotoFinta extends File {
    constructor(byte, nome, sonda, rotta = false) {
        super([byte], nome, { type: 'image/png' });
        this.sonda = sonda;
        this.rotta = rotta;
    }
    async _leggi(blob) {
        this.sonda.inizio(this.name);
        try {
            if (this.rotta) throw new DOMException('The requested file could not be read', 'NotReadableError');
            const ab = await blob.arrayBuffer();
            this.sonda.fine(ab.byteLength);
            return ab;
        } catch (e) { this.sonda.fine(0); throw e; }
    }
    arrayBuffer() { return this._leggi(super.slice()); }
    slice(da, a, tipo) {
        const parte = super.slice(da, a, tipo);
        return { size: parte.size, type: parte.type, arrayBuffer: () => this._leggi(parte), slice: (...x) => parte.slice(...x) };
    }
}
export const byteDi = (n, seme) => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = (i * 31 + seme * 7) & 0xFF; return b; };

// ITALIANO: una cartella aperta con "Carica cartella": getFileHandle(nome).getFile() rilegge la foto
//           com'e' ADESSO sul disco (`attuali`), o manca (NotFoundError).
// ENGLISH: a folder opened with "Load folder": getFileHandle(name).getFile() re-reads the photo as it
//          is NOW on disk (`attuali`), or it is missing (NotFoundError).
export const cartellaFinta = (attuali) => ({
    name: 'dataset',
    getFileHandle: async (nome) => {
        if (!attuali.has(nome)) throw new DOMException('A requested file or directory could not be found', 'NotFoundError');
        return { getFile: async () => attuali.get(nome) };
    },
});

/* ITALIANO: prepara l'app finta con queste foto. apri() preme "Esporta (.zip)"; conferma(foto,
   rinomina) preme "Esporta" nella finestra di scelta. Restituisce notifiche, scelta mostrata,
   byte dell'archivio e come si e' chiuso il file di destinazione. `ordine` = la scelta di
   "Ordina per" (sortOrder dell'app).
   ENGLISH: sets up the fake app with these photos. apri() presses "Export (.zip)"; conferma(photos,
   rename) presses "Export" in the choice dialog. Returns notifications, the choice shown, the
   archive bytes and how the destination file ended. `ordine` = the "Sort by" choice (the app's
   sortOrder). */
export const creaApp = (images, sonda, { conFinestra = true, ordine = 'name-asc' } = {}) => {
    const r = { notifiche: [], scelta: null, pezzi: [], chiuso: false, annullato: false, scaricato: null };
    const finestra = {};
    if (conFinestra) {
        finestra.showSaveFilePicker = async () => {
            // ITALIANO: la finestra vera resta aperta finche' l'utente sceglie: qui un attimo.
            // ENGLISH: the real dialog stays open until the user picks: a moment here.
            await new Promise(ok => setTimeout(ok, 20));
            sonda.eventi.push('file scelto');
            return {
                name: 'dataset.zip',
                createWritable: async () => ({
                    write: async (pezzo) => {
                        const b = pezzo instanceof Uint8Array ? pezzo : new Uint8Array(pezzo);
                        // ITALIANO: il disco vero ci mette un po': il pezzo conta come scritto solo
                        //           dopo, cosi' uno scrittore che non aspetta il disco si vede.
                        // ENGLISH: the real disk takes a while: the chunk counts as written only
                        //          afterwards, so a writer that does not wait for the disk shows up.
                        await new Promise(ok => setTimeout(ok, 1));
                        r.pezzi.push(Buffer.from(b));
                        sonda.scrittura(b.length);
                    },
                    close: async () => { r.chiuso = true; },
                    abort: async () => { r.annullato = true; },
                }),
            };
        };
    }
    const documento = {
        createElement: () => ({ click() { } }),
        body: { appendChild() { }, removeChild() { } },
    };
    const url = {
        createObjectURL: (blob) => { r.scaricato = blob; return 'blob:finto'; },
        revokeObjectURL() { },
    };
    const nomi = ['images', 't', 'showNotification', 'setIsSaving', 'setImportProgress', 'getOrderedTagString', 'soundManager', 'window', 'document', 'URL', 'console',
        'setExportChoice', 'exportChoice', 'JSZip', 'buildTagFileName', 'sanitizeFileName', 'sidecarTagFileName', 'scriviZip', 'ERRORE_LETTURA_ZIP',
        'applySort', 'sortOrder', 'isSaving', 'txtNonLettoInVigore'];
    const costruisci = (exportChoice) => new Function(...nomi,
        pezzi.formatoPeso + '\n' + pezzi.exportAllAsZip + '\n' + pezzi.handleExportAll + '\n' + pezzi.avviaExport +
        '\nreturn { exportAllAsZip, handleExportAll, avviaExport: typeof avviaExport === "function" ? avviaExport : null };')(
        images, t, (m, tipo) => r.notifiche.push([m, tipo]), () => { }, () => { }, (tags) => (tags.length ? tags.join(', ') + ',' : ''),
        { chime() { }, pop() { } }, finestra, documento, url, { log() { }, warn() { }, error() { } },
        (v) => { r.scelta = v; }, exportChoice, JSZip, P.buildTagFileName, P.sanitizeFileName, P.sidecarTagFileName, Z.scriviZip, Z.ERRORE_LETTURA_ZIP,
        applySort, ordine, false, S.txtNonLettoInVigore);
    r.apri = () => { costruisci(null).handleExportAll(); return r; };
    r.conferma = async (conImmagini, rinomina = false) => {
        const f = costruisci(r.scelta);
        const scelta = r.scelta;
        r.scelta = null;
        // ITALIANO: il codice di prima non aveva avviaExport: la finestra passava sempre lo stesso
        //           elenco a exportAllAsZip. In tutti e due i casi si aspetta la fine dell'esportazione.
        // ENGLISH: the previous code had no avviaExport: the dialog always handed the same list to
        //          exportAllAsZip. Either way the export is awaited to its end.
        if (f.avviaExport) await f.avviaExport(conImmagini, rinomina);
        else if (scelta) await f.exportAllAsZip(scelta.imgs, conImmagini, rinomina);
        return r;
    };
    r.esporta = async (conImmagini, rinomina = false) => { r.apri(); return r.conferma(conImmagini, rinomina); };
    r.archivio = async () => {
        if (r.pezzi.length === 0) return null;
        const zip = await JSZip.loadAsync(Buffer.concat(r.pezzi), { checkCRC32: true });
        const voci = {};
        for (const nome of Object.keys(zip.files).sort()) {
            if (zip.files[nome].dir) continue;
            voci[nome] = Buffer.from(await zip.files[nome].async('uint8array'));
        }
        return voci;
    };
    return r;
};
