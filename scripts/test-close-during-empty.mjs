/* ITALIANO: PROVA DELLA X DELLA FINESTRA MENTRE "SVUOTA CESTINO" E' IN CORSO
   "Svuota Cestino" (e la cancellazione definitiva dopo la seconda conferma) toglie le foto una alla
   volta: prima l'immagine, poi il .txt. Con centinaia di foto ci vogliono decine di secondi.
   Chiudendo la finestra (X o Alt+F4) in quel momento, senza modifiche non salvate, il programma si
   chiudeva subito: le foto non ancora tolte restavano nella cartella e alla riapertura tornavano in
   galleria come foto normali (il cestino dell'app non si salva), senza nessun avviso; fra le due
   chiamate poteva restare un .txt orfano. Ora la prima X si ferma e dice di aspettare, come per
   "Annulla lo svuotamento"; una seconda X chiude comunque.
   Si esegue il testo VERO dell'effetto che ascolta la chiusura, preso da src/App.tsx, con le regole
   vere di src/utils/closeGuard.ts e i testi veri di src/constants.ts (compilati con esbuild).
   Uso:  node scripts/test-close-during-empty.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE WINDOW'S X WHILE "EMPTY TRASH" IS RUNNING
   "Empty Trash" (and the permanent delete after the second confirmation) removes the photos one at
   a time: the image first, then the .txt. With hundreds of photos it takes tens of seconds.
   Closing the window (X or Alt+F4) at that moment, with no unsaved edits, closed the program at
   once: the photos not removed yet stayed in the folder and on reopening came back to the gallery
   as normal photos (the app's trash is not saved), with no notice; between the two calls an orphan
   .txt could be left. Now the first X stops and says to wait, as for "Undo the emptying"; a second
   X closes anyway.
   The REAL text of the effect listening for the close, taken from src/App.tsx, is run with the
   real rules of src/utils/closeGuard.ts and the real strings of src/constants.ts (compiled with
   esbuild).
   Usage:  node scripts/test-close-during-empty.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => {
    const u = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
};
const G = await carica('src/utils/closeGuard.ts');
const lingue = (await carica('src/constants.ts')).translations;
const t = lingue.en;
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const manca = (cosa) => { console.log('NO  non trovato in src/App.tsx: ' + cosa); console.log('\nPROBLEMI: 1 (1 controlli)'); process.exit(1); };

const iAscolto = sorgente.indexOf("window.addEventListener('beforeunload'");
if (iAscolto < 0) manca("window.addEventListener('beforeunload', ...)");
const iEffetto = sorgente.lastIndexOf('    useEffect(() => {', iAscolto);
const fineEffetto = /\r?\n    \}, \[[^\]]*\]\);\r?\n/g;
fineEffetto.lastIndex = iAscolto;
const mEffetto = fineEffetto.exec(sorgente);
if (iEffetto < 0 || !mEffetto) manca("l'effetto di beforeunload");
const testoEffetto = 'const effettoChiusura = ' + sorgente.slice(iEffetto + '    useEffect('.length, mEffetto.index + mEffetto[0].indexOf(',')) + ';';
const codice = (await esbuild.transform(testoEffetto, { loader: 'ts' })).code;
// ITALIANO: ogni ref letto dall'effetto parte da false, come un useRef; quelli che servono si impostano sotto.
// ENGLISH: every ref the effect reads starts at false, like a useRef; the needed ones are set below.
const nomiRef = [...new Set(testoEffetto.match(/\b\w+Ref\b/g) || [])];
const NOMI = ['window', 'localStorage', 'dirHandle', 'scriviBackupSubito', 'modificheNonSalvate', 'setTimeout', 'setIsTagEditorOpen',
    'setSaveCloseDialog', 'showNotification', 't', ...nomiRef];
const fabbrica = new Function(...NOMI, codice + '\nreturn effettoChiusura;');

const foto = (name, tags, originalTags, isTrashed = false) => ({ id: name, file: { name }, tags, originalTags, isTrashed, backupKey: 'E:\\d\x1f' + name, lottoImport: 'l1', cartellaImport: 'd' });
const app = ({ immagini, svuotamento = false, ripristino = false, electron = true }) => {
    const a = { ascoltatori: [], notifiche: [], finestra: { isOpen: false, isSaving: false }, archivio: new Map() };
    const win = {
        electronAPI: electron ? {} : undefined,
        addEventListener: (tipo, fn) => { if (tipo === 'beforeunload') a.ascoltatori.push(fn); },
        removeEventListener: () => { },
    };
    const memoria = { getItem: (k) => (a.archivio.has(k) ? a.archivio.get(k) : null), setItem: (k, v) => a.archivio.set(k, String(v)), removeItem: (k) => a.archivio.delete(k) };
    a.refs = {};
    for (const n of nomiRef) a.refs[n] = { current: false };
    a.refs.imagesRef = { current: immagini };
    a.refs.fotoChiuseRef = { current: new Map() };
    a.refs.globalTriggersRef = { current: [] };
    a.refs.saveCloseDialogRef = { current: a.finestra };
    if (a.refs.svuotamentoInCorsoRef) a.refs.svuotamentoInCorsoRef.current = svuotamento;
    if (a.refs.ripristinoInCorsoRef) a.refs.ripristinoInCorsoRef.current = ripristino;
    fabbrica(win, memoria, null, G.scriviBackupSubito, G.modificheNonSalvate, setTimeout, () => { },
        (d) => { a.finestra = d; a.refs.saveCloseDialogRef.current = d; }, (m, tipo) => a.notifiche.push([m, tipo]), t,
        ...nomiRef.map(n => a.refs[n]))();
    a.chiudi = () => {
        const e = { defaultPrevented: false, returnValue: undefined, preventDefault() { this.defaultPrevented = true; } };
        for (const fn of a.ascoltatori) fn(e);
        return e.defaultPrevented;
    };
    return a;
};
const attendi = () => new Promise((r) => setTimeout(r, 5));
const testo = (k) => (typeof t[k] === 'string' && t[k].length > 0 ? t[k] : '(manca ' + k + ' in constants.ts)');

console.log('\n--- il testo esiste nelle nove lingue ---');
dice('closeWhileEmptying in it/en/fr/es/de/zh/ja/pt/ru', [],
    ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'].filter(l => !lingue[l] || typeof lingue[l].closeWhileEmptying !== 'string' || lingue[l].closeWhileEmptying.length < 20));

console.log('\n--- X della finestra mentre "Svuota Cestino" toglie le foto ---');
{
    dice('premessa: la chiusura sa se uno svuotamento e\' in corso (svuotamentoInCorsoRef)', true, nomiRef.includes('svuotamentoInCorsoRef'));
    // ITALIANO: le foto ancora da togliere sono nel cestino dell'app: nessuna modifica non salvata.
    // ENGLISH: the photos still to remove are in the app's trash: no unsaved edits.
    const a = app({ immagini: [foto('a.png', ['x'], ['x'], true), foto('b.png', ['y'], ['y'])], svuotamento: true });
    dice('senza modifiche: la prima X si ferma (prima chiudeva a meta\' svuotamento)', true, a.chiudi());
    await attendi();
    dice('...e l\'avviso dice di aspettare o di chiudere di nuovo', [[testo('closeWhileEmptying'), 'info']], a.notifiche);
    dice('...una seconda X chiude comunque', false, a.chiudi());
    const b = app({ immagini: [foto('a.png', ['x'], ['x'], true), foto('b.png', ['y', 'nuovo'], ['y'])], svuotamento: true });
    dice('con modifiche: anche li\' la prima X si ferma', true, b.chiudi());
    await attendi();
    dice('...con l\'avviso dello svuotamento, non la finestra a tre scelte', [false, [[testo('closeWhileEmptying'), 'info']]], [b.finestra.isOpen, b.notifiche]);
    dice('con modifiche: una seconda X chiude comunque, come dice l\'avviso', false, b.chiudi());
    await attendi();
    dice('...senza aprire la finestra a tre scelte', false, b.finestra.isOpen);
    // ITALIANO: lo svuotamento finisce: dalla volta dopo la X si comporta come sempre (lo azzera App.tsx a ogni disegno).
    // ENGLISH: the emptying ends: from then on the X behaves as always (App.tsx resets it on every render).
    if (a.refs.svuotamentoInCorsoRef) a.refs.svuotamentoInCorsoRef.current = false;
    if (a.refs.chiusuraInSvuotamentoRef) a.refs.chiusuraInSvuotamentoRef.current = false;
    dice('svuotamento finito, niente modifiche: la X chiude subito', false, a.chiudi());
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const a = app({ immagini: [foto('a.png', ['x'], ['x'])] });
    dice('nessuno svuotamento, niente modifiche: la X chiude subito', false, a.chiudi());
    const b = app({ immagini: [foto('a.png', ['x', 'nuovo'], ['x'])] });
    dice('nessuno svuotamento, con modifiche: la X si ferma', true, b.chiudi());
    await attendi();
    dice('...e compare la finestra a tre scelte, senza avvisi', [true, []], [b.finestra.isOpen, b.notifiche]);
    const c = app({ immagini: [foto('a.png', ['x'], ['x'], true)], svuotamento: true, electron: false });
    dice('anteprima del browser: non si ferma niente, come prima', false, c.chiudi());
    const d = app({ immagini: [foto('a.png', ['x'], ['x'])], ripristino: true });
    d.chiudi();
    await attendi();
    dice('"Annulla lo svuotamento" in corso ha ancora il suo avviso', [[testo('closeWhileRestoring'), 'info']], d.notifiche);
}

process.exit(esito());
