/* ITALIANO: PROVA DELLA X DELLA FINESTRA SUBITO DOPO AVER CHIUSO L'ULTIMA FOTO
   Una foto con modifiche non salvate si chiude con la sua X ("le modifiche andranno perse"). Il
   backup anti-crash si ricalcola un secondo dopo e la toglie. Ma se in quel secondo si chiude la
   finestra (X o Alt+F4), il timer muore con la pagina, e la chiusura usciva subito "perche' non ci
   sono foto" senza riscrivere il backup: alla riapertura della cartella le modifiche buttate via
   tornavano come "recuperate" e il primo Salva le scriveva nel .txt.
   Ora la chiusura riscrive il backup anche con l'elenco vuoto, se nella sessione c'erano foto.
   All'avvio del programma (nessuna foto ancora entrata) un backup di un crash resta com'e'.
   Si esegue il testo VERO dell'effetto che ascolta la chiusura, preso da src/App.tsx, con le regole
   vere di src/utils/closeGuard.ts (compilate con esbuild).
   Uso:  node scripts/test-window-close-last-photo.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE WINDOW'S X RIGHT AFTER CLOSING THE LAST PHOTO
   A photo with unsaved edits is closed with its X ("the changes will be lost"). The crash backup is
   recomputed one second later and drops it. But if the window is closed within that second (X or
   Alt+F4), the timer dies with the page, and the close returned at once "because there are no
   photos" without rewriting the backup: reopening the folder brought the discarded edits back as
   "recovered" and the first Save wrote them into the .txt.
   Now the close rewrites the backup with an empty list too, when the session had photos. At
   program start (no photo loaded yet) a crash backup is left as it is.
   The REAL text of the effect listening for the close, taken from src/App.tsx, is run with the real
   rules of src/utils/closeGuard.ts (compiled with esbuild).
   Usage:  node scripts/test-window-close-last-photo.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const u = await esbuild.build({ entryPoints: [path.join(radice, 'src/utils/closeGuard.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const G = await import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const manca = (cosa) => { console.log('NO  non trovato in src/App.tsx: ' + cosa); console.log('\nPROBLEMI: 1 (1 controlli)'); process.exit(1); };

const iAscolto = sorgente.indexOf("window.addEventListener('beforeunload'");
if (iAscolto < 0) manca("window.addEventListener('beforeunload', ...)");
const iEffetto = sorgente.lastIndexOf('    useEffect(() => {', iAscolto);
const fineEffetto = /\r?\n    \}, \[[^\]]*\]\);\r?\n/g;
fineEffetto.lastIndex = iAscolto;
const mEffetto = fineEffetto.exec(sorgente);
if (iEffetto < 0 || !mEffetto) manca("l'effetto di beforeunload");
const testo = sorgente.slice(iEffetto + '    useEffect('.length, mEffetto.index + mEffetto[0].indexOf(','));
const codice = (await esbuild.transform('const effettoChiusura = ' + testo + ';', { loader: 'ts' })).code;
// ITALIANO: ogni ref che l'effetto legge parte da un valore neutro (false), come un useRef.
// ENGLISH: every ref the effect reads starts from a neutral value (false), like a useRef.
const nomiRef = [...new Set(testo.match(/\b\w+Ref\b/g) || [])];
const NOMI = ['window', 'localStorage', 'dirHandle', 'scriviBackupSubito', 'modificheNonSalvate', 'setTimeout',
    'setIsTagEditorOpen', 'setSaveCloseDialog', 'showNotification', 't', ...nomiRef];
const fabbrica = new Function(...NOMI, codice + '\nreturn effettoChiusura;');

const SEP = '\x1f';
const foto = (name, tags, originalTags) => ({
    id: name, file: { name }, tags, originalTags, backupKey: 'E:\\dataset' + SEP + name, lottoImport: 'l1', cartellaImport: 'dataset',
});
// ITALIANO: l'app finta. `conFoto` = backupConFotoRef: nella sessione sono gia' entrate delle foto.
// ENGLISH: the fake app. `conFoto` = backupConFotoRef: photos have already entered the session.
const app = ({ immagini, chiuse = [], conFoto, electron = true, archivio = new Map() }) => {
    const a = { ascoltatori: [], archivio };
    const win = {
        electronAPI: electron ? {} : undefined,
        addEventListener: (tipo, fn) => { if (tipo === 'beforeunload') a.ascoltatori.push(fn); },
        removeEventListener: () => { },
    };
    const memoria = { getItem: (k) => (archivio.has(k) ? archivio.get(k) : null), setItem: (k, v) => archivio.set(k, String(v)), removeItem: (k) => archivio.delete(k) };
    const refs = {};
    for (const n of nomiRef) refs[n] = { current: false };
    refs.imagesRef = { current: immagini };
    refs.fotoChiuseRef = { current: new Map(chiuse.map(f => [f.id, { id: f.id, name: f.file.name, lotto: f.lottoImport, cartella: f.cartellaImport }])) };
    refs.globalTriggersRef = { current: [] };
    refs.saveCloseDialogRef = { current: { isOpen: false, isSaving: false } };
    if (refs.backupConFotoRef) refs.backupConFotoRef.current = conFoto;
    fabbrica(win, memoria, null, G.scriviBackupSubito, G.modificheNonSalvate, setTimeout, () => { }, () => { }, () => { }, {},
        ...nomiRef.map(n => refs[n]))();
    a.chiudi = () => {
        const e = { defaultPrevented: false, returnValue: undefined, preventDefault() { this.defaultPrevented = true; } };
        for (const fn of a.ascoltatori) fn(e);
        return e.defaultPrevented;
    };
    return a;
};
// ITALIANO: il backup scritto un secondo dopo la modifica, come fa l'effetto col timer.
// ENGLISH: the backup written one second after the edit, as the effect with the timer does.
const backupDi = (lista) => {
    const archivio = new Map();
    const memoria = { getItem: (k) => (archivio.has(k) ? archivio.get(k) : null), setItem: (k, v) => archivio.set(k, String(v)), removeItem: (k) => archivio.delete(k) };
    G.scriviBackupSubito(memoria, lista, [], 'dataset', []);
    return archivio;
};

dice('premessa: l\'effetto di chiusura legge backupConFotoRef (il ricordo che la sessione ha avuto foto)', true, nomiRef.includes('backupConFotoRef'));

console.log('\n--- ultima foto chiusa con la X, poi la finestra entro un secondo ---');
for (const electron of [true, false]) {
    const modificata = foto('0002.png', ['smile', 'buttata via'], ['smile']);
    const archivio = backupDi([modificata]);
    const prima = archivio.has('tagBackup');
    const a = app({ immagini: [], chiuse: [modificata], conFoto: true, electron, archivio });
    const fermata = a.chiudi();
    dice((electron ? 'Electron' : 'anteprima del browser') + ': il backup c\'era, alla chiusura le modifiche buttate via spariscono', [true, false, false],
        [prima, archivio.has('tagBackup'), fermata]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const crash = backupDi([foto('0002.png', ['smile', 'da recuperare'], ['smile'])]);
    const salvato = crash.get('tagBackup');
    const a = app({ immagini: [], conFoto: false, archivio: crash });
    dice('avvio del programma, nessuna foto ancora entrata: il backup di un crash resta com\'era', [false, salvato], [a.chiudi(), crash.get('tagBackup') || null]);
    const altra = foto('0002.png', ['smile', 'altra cartella'], ['smile']);
    // ITALIANO: l'import della sessione del crash: un lotto diverso da quelli di adesso (nell'app e' un UUID).
    // ENGLISH: the import of the crashed session: a batch other than today's (a UUID in the app).
    altra.cartellaImport = 'char2'; altra.backupKey = 'E:\\char2' + SEP + '0002.png'; altra.lottoImport = 'l-crash';
    const archivio = backupDi([altra]);
    const tenuto = archivio.get('tagBackup');
    const chiusa = foto('0009.png', ['x', 'y'], ['x']);
    const b = app({ immagini: [], chiuse: [chiusa], conFoto: true, archivio });
    b.chiudi();
    dice('una cartella mai riaperta dopo un crash resta nel backup', true, !!archivio.get('tagBackup') && JSON.parse(archivio.get('tagBackup')).sources.length === JSON.parse(tenuto).sources.length);
    const c = app({ immagini: [foto('a.png', ['x', 'nuovo'], ['x'])], conFoto: true });
    dice('con foto ancora aperte e modificate la chiusura si ferma come prima, e il backup le ha', [true, true], [c.chiudi(), c.archivio.has('tagBackup')]);
}

process.exit(esito());
