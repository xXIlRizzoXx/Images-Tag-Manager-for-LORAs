/* ITALIANO: PROVA DELLA X DELLA FINESTRA MENTRE "ANNULLA LO SVUOTAMENTO" E' IN CORSO
   "Annulla lo svuotamento" riprende prima le immagini dal Cestino di Windows e poi, con una
   seconda chiamata, i loro .txt. Chiudendo la finestra (X o Alt+F4) in quel momento, senza
   modifiche non salvate, il programma si chiudeva subito: le immagini tornavano nella cartella e
   i .txt restavano nel Cestino di Windows, senza un avviso. Riaprendo, le foto erano senza tag e
   il ricordo dello svuotamento era perso. Ora la prima X si ferma e dice di aspettare (come durante
   una scrittura); una seconda X chiude comunque, cosi' un ripristino bloccato non tiene la finestra
   aperta per sempre.
   Si esegue il testo VERO dell'effetto che ascolta la chiusura, preso da src/App.tsx, con le regole
   vere di src/utils/closeGuard.ts e i testi veri di src/constants.ts (compilati con esbuild).
   Uso:  node scripts/test-close-during-undo.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE WINDOW'S X WHILE "UNDO THE EMPTYING" IS RUNNING
   "Undo the emptying" takes the images back out of the Windows Recycle Bin first and then, with a
   second call, their .txt files. Closing the window (X or Alt+F4) at that moment, with no unsaved
   edits, closed the program at once: the images went back into the folder and the .txt files
   stayed in the Windows Recycle Bin, with no notice. On reopening the photos had no tags and the
   record of the emptying was gone. Now the first X stops and says to wait (as during a write); a
   second X closes anyway, so a stuck restore does not keep the window open forever.
   The REAL text of the effect listening for the close, taken from src/App.tsx, is run with the
   real rules of src/utils/closeGuard.ts and the real strings of src/constants.ts (compiled with
   esbuild).
   Usage:  node scripts/test-close-during-undo.mjs      (exits with code 1 if anything is off) */

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

const foto = (name, tags, originalTags) => ({ id: name, file: { name }, tags, originalTags, backupKey: 'E:\\d\x1f' + name, lottoImport: 'l1', cartellaImport: 'd' });
const app = ({ immagini, ripristino = false, scrittura = false, electron = true }) => {
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
    if (a.refs.isSavingRef) a.refs.isSavingRef.current = scrittura;
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
dice('closeWhileRestoring in it/en/fr/es/de/zh/ja/pt/ru', [],
    ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'].filter(l => !lingue[l] || typeof lingue[l].closeWhileRestoring !== 'string' || lingue[l].closeWhileRestoring.length < 20));

console.log('\n--- X della finestra mentre "Annulla lo svuotamento" riprende i file ---');
{
    dice('premessa: la chiusura sa se un ripristino e\' in corso (ripristinoInCorsoRef)', true, nomiRef.includes('ripristinoInCorsoRef'));
    const a = app({ immagini: [foto('a.png', ['x'], ['x'])], ripristino: true });
    dice('senza modifiche: la prima X si ferma (prima chiudeva a meta\' ripristino)', true, a.chiudi());
    await attendi();
    dice('...e l\'avviso dice di aspettare o di chiudere di nuovo', [[testo('closeWhileRestoring'), 'info']], a.notifiche);
    dice('...una seconda X chiude comunque', false, a.chiudi());
    const b = app({ immagini: [foto('a.png', ['x', 'nuovo'], ['x'])], ripristino: true });
    dice('con modifiche: anche li\' la prima X si ferma', true, b.chiudi());
    await attendi();
    dice('...con l\'avviso del ripristino, non la finestra a tre scelte', [false, [[testo('closeWhileRestoring'), 'info']]], [b.finestra.isOpen, b.notifiche]);
    // ITALIANO: l'avviso promette che una seconda X chiude: con modifiche apriva la finestra a tre scelte.
    // ENGLISH: the notice promises that a second X closes: with edits it opened the three-choice dialog.
    dice('con modifiche: una seconda X chiude comunque, come dice l\'avviso', false, b.chiudi());
    await attendi();
    dice('...senza aprire la finestra a tre scelte', false, b.finestra.isOpen);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const a = app({ immagini: [foto('a.png', ['x'], ['x'])] });
    dice('nessun ripristino, niente modifiche: la X chiude subito', false, a.chiudi());
    const b = app({ immagini: [foto('a.png', ['x', 'nuovo'], ['x'])] });
    dice('nessun ripristino, con modifiche: la X si ferma', true, b.chiudi());
    await attendi();
    dice('...e compare la finestra a tre scelte, senza avvisi', [true, []], [b.finestra.isOpen, b.notifiche]);
    const c = app({ immagini: [foto('a.png', ['x'], ['x'])], ripristino: true, electron: false });
    dice('anteprima del browser: non si ferma niente, come prima', false, c.chiudi());
    const d = app({ immagini: [foto('a.png', ['x'], ['x'])], scrittura: true });
    d.chiudi();
    await attendi();
    dice('una scrittura in corso ha ancora il suo avviso', [[testo('closeWhileWriting'), 'info']], d.notifiche);
}

process.exit(esito());
