/* ITALIANO: PROVA DI DUE IMPORT INSIEME
   Mentre un import lungo genera le miniature, "Carica immagini", "Carica cartella" e il
   trascinamento restano liberi: se ne puo' far partire un secondo. Il primo, finendo, spegneva la
   striscia di avanzamento (isImporting a false) mentre il secondo lavorava ancora: le sue foto
   comparivano minuti dopo senza nessun segno di attivita', e chi pensava a un errore importava di
   nuovo (foto doppie). Ora la striscia resta finche' l'ULTIMO import in corso non finisce, e un
   import che parte durante un altro non rimette la barra a zero.
   Si esegue il testo VERO di processImportData preso da src/App.tsx (compilato con esbuild), con
   le regole vere di src/utils/ e miniature finte che aspettano un via.
   Uso:  node scripts/test-import-overlap.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF TWO IMPORTS AT ONCE
   While a long import generates the thumbnails, "Load images", "Load folder" and drag and drop stay
   free: a second one can be started. The first one, when done, switched the progress strip off
   (isImporting false) while the second was still working: its photos showed up minutes later with
   no sign of activity, and whoever took it for a failure imported again (duplicate photos). Now the
   strip stays until the LAST running import ends, and an import started during another does not
   reset the bar to zero.
   The REAL text of processImportData taken from src/App.tsx is run (compiled with esbuild), with
   the real rules of src/utils/ and fake thumbnails that wait for a go.
   Usage:  node scripts/test-import-overlap.mjs      (exits with code 1 if anything is off) */

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
const S = await carica('src/utils/sidecarTags.ts');
const B = await carica('src/utils/tagBackup.ts');
const N = await carica('src/utils/importNotice.ts');
const t = (await carica('src/constants.ts')).translations.en;
const { dice, esito } = creaControlli();

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('    const processImportData = async (');
const chiusura = /\r?\n    \};\r?\n/g;
chiusura.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : chiusura.exec(sorgente);
if (inizio < 0 || !fine) { console.log('NO  processImportData non trovato in src/App.tsx'); process.exit(1); }
const testo = sorgente.slice(inizio, fine.index + fine[0].length);
const codice = (await esbuild.transform(testo, { loader: 'ts' })).code;
// ITALIANO: i ref che processImportData legge oltre a quelli noti: ognuno parte da 0, come un useRef(0).
// ENGLISH: the refs processImportData reads besides the known ones: each starts at 0, like a useRef(0).
const NOTI = ['globalTriggersRef', 'anteprimeProgettoRef', 'folderInputRef'];
const altriRef = [...new Set(testo.match(/\b\w+Ref\b/g) || [])].filter(n => !NOTI.includes(n));
const NOMI = ['globalTriggersRef', 'setImages', 'setImportSummary', 'setDirHandle', 'setIsImporting', 'setImportProgress',
    'folderSignature', 'nuovoIdFoto', 'backupDellImport', 'localStorage', 'makeFolderKeyer', 'makeBackupKeyer', 'TXT_MAX_BYTES',
    'parseSidecarText', 'generateThumbnail', 'tagDiImport', 'tagDaRipristinare', 'asDirHandle', 'anteprimeProgettoRef',
    'soundManager', 'avvisoImport', 't', 'showNotification', 'folderInputRef', 'console', 'URL', ...altriRef];
const fabbrica = new Function(...NOMI, codice + '\nreturn processImportData;');

// ITALIANO: l'app finta: le chiamate a setIsImporting e setImportProgress si annotano.
// ENGLISH: the fake app: the calls to setIsImporting and setImportProgress are recorded.
const creaApp = () => {
    const a = { images: [], striscia: [], barra: [], cancelli: new Map(), notifiche: [], suoni: 0, revocati: [], anteprime: new Set() };
    const refs = Object.fromEntries(altriRef.map(n => [n, { current: 0 }]));
    let id = 0;
    a.importa = fabbrica({ current: [] }, (fn) => { a.images = typeof fn === 'function' ? fn(a.images) : fn; }, () => { }, () => { },
        (v) => { a.striscia.push(v); }, (v) => { a.barra.push(v); }, B.folderSignature, () => 'id' + (++id), B.backupDellImport,
        { getItem: () => null }, S.makeFolderKeyer, () => (f) => 'dataset\x1f' + f.name, 1024 * 1024, S.parseSidecarText,
        async (f) => { await a.cancelli.get(f.name); return { url: 'blob:finto', width: 1, height: 1 }; }, S.tagDiImport,
        B.tagDaRipristinare, () => null, { current: a.anteprime }, { chime() { a.suoni++; } }, N.avvisoImport, t, (m, tipo) => { a.notifiche.push([m, tipo]); },
        { current: null }, { log() { }, warn() { }, error() { } }, { revokeObjectURL: (u) => { a.revocati.push(u); } }, ...altriRef.map(n => refs[n]));
    a.refs = refs;
    // ITALIANO: un cancello per foto: la sua miniatura finisce solo quando lo si apre.
    // ENGLISH: one gate per photo: its thumbnail ends only when it is opened.
    a.cancello = (nome) => { let apri; a.cancelli.set(nome, new Promise(ok => { apri = ok; })); return apri; };
    a.inCorso = () => a.striscia[a.striscia.length - 1] === true;
    return a;
};
const attendi = (ms) => new Promise(ok => setTimeout(ok, ms));

console.log('\n--- un secondo import parte mentre il primo genera le miniature ---');
{
    const a = creaApp();
    const apriPrimo = a.cancello('a.png');
    const apriSecondo = a.cancello('b.png');
    const primo = a.importa([{ name: 'a.png' }], []);
    await attendi(350);
    const barraPrima = a.barra.length;
    const secondo = a.importa([{ name: 'b.png' }], []);
    await attendi(350);
    dice('il secondo, partendo, non rimette la barra del primo a zero', false, a.barra.slice(barraPrima).includes(0));
    apriPrimo();
    await primo;
    dice('finito il primo, la striscia resta accesa: il secondo lavora ancora', true, a.inCorso());
    apriSecondo();
    await secondo;
    dice('finito anche il secondo, la striscia si spegne', false, a.inCorso());
    dice('...e le foto di tutti e due sono entrate', ['a.png', 'b.png'], a.images.map(i => i.file.name));
}

console.log('\n--- Reset o Chiudi progetto mentre un import genera le miniature ---');
{
    // ITALIANO: Reset e Chiudi progetto fanno avanzare progettoGenRef (un progetto nuovo). Le foto
    //           dell'import di prima finivano nel progetto nuovo, con la sua trigger, e un Salva la
    //           scriveva nei .txt della cartella chiusa. Ora restano fuori: niente foto, niente
    //           "Immagini caricate", miniature liberate, striscia spenta.
    // ENGLISH: Reset and Close project move progettoGenRef on (a new project). The photos of the
    //          import from before landed in the new project, with its trigger, and a Save wrote it
    //          into the closed folder's .txt files. Now they stay out: no photo, no "Images loaded",
    //          thumbnails released, strip off.
    const a = creaApp();
    const apri = a.cancello('b1.png');
    const lavoro = a.importa([{ name: 'b1.png' }], []);
    await attendi(350);
    dice('premessa: processImportData guarda progettoGenRef', true, !!a.refs.progettoGenRef);
    if (a.refs.progettoGenRef) a.refs.progettoGenRef.current++;
    apri();
    await lavoro;
    dice('le foto dell\'import di prima non entrano nel progetto nuovo', [], a.images.map(i => i.file.name));
    dice('...nessun avviso "Immagini caricate" e nessun suono', [[], 0], [a.notifiche, a.suoni]);
    dice('...le loro miniature si liberano e non restano fra quelle del progetto', [['blob:finto'], 0], [a.revocati, a.anteprime.size]);
    dice('...e la striscia di avanzamento si spegne', false, a.inCorso());
    // ITALIANO: un import partito DOPO il Reset entra come sempre.
    // ENGLISH: an import started AFTER the Reset goes in as always.
    const apri2 = a.cancello('n.png');
    const nuovo = a.importa([{ name: 'n.png' }], []);
    apri2();
    await nuovo;
    dice('un import partito dopo il Reset entra come sempre', [['n.png'], 1], [a.images.map(i => i.file.name), a.suoni]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const a = creaApp();
    const apri = a.cancello('c.png');
    const solo = a.importa([{ name: 'c.png' }], []);
    await attendi(50);
    dice('un import solo accende la striscia e parte da zero', [true, true], [a.inCorso(), a.barra[0] === 0]);
    apri();
    await solo;
    dice('...e alla fine la spegne', false, a.inCorso());
    const b = creaApp();
    b.cancello('d.png');
    b.cancelli.set('d.png', Promise.reject(new Error('miniatura rotta')));
    b.cancelli.get('d.png').catch(() => { });
    await b.importa([{ name: 'd.png' }], []);
    dice('una miniatura che fallisce non lascia la striscia accesa', false, b.inCorso());
    const d = creaApp();
    d.cancelli.set('f.png', Promise.resolve());
    await d.importa([{ name: 'f.png' }], []);
    const apriG = d.cancello('g.png');
    const dopo = d.importa([{ name: 'g.png' }], []);
    await attendi(50);
    dice('un import dopo un altro gia\' finito riparte da zero e riaccende la striscia', [true, 0], [d.inCorso(), d.barra[d.barra.length - 1]]);
    apriG();
    await dopo;
    dice('...e la spegne alla fine', false, d.inCorso());
}

process.exit(esito());
