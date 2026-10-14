/* ITALIANO: PROVA DI "CHIUDI PROGETTO" E DELLA X DELLA FINESTRA MENTRE UN'ESPORTAZIONE SCRIVE
   Durante un'esportazione lunga (isSaving acceso) i tasti Salva ed Esporta sono spenti, ma
   "Chiudi progetto" no: con modifiche non salvate, "Salva e chiudi" faceva partire un salvataggio
   che dopo mezzo secondo spegneva la barra dell'esportazione ancora in corso. Dalla X della finestra
   era peggio: senza modifiche la finestra si chiudeva subito, a meta' archivio, senza nessuna
   domanda (e l'archivio a meta' andava perso). Ora "Chiudi progetto" si spegne mentre si scrive,
   "Salva e chiudi" aspetta, e in Electron la prima X durante una scrittura si ferma e dice di
   aspettare: una seconda X chiude comunque, come chiede l'avviso.
   Si eseguono i testi VERI dell'effetto che ascolta la chiusura e di handleSaveAndCloseProject,
   presi da src/App.tsx, con le regole vere di src/utils/closeGuard.ts e i testi veri di
   src/constants.ts (compilati con esbuild); il tasto si legge da src/App.tsx.
   Uso:  node scripts/test-close-during-write.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "CLOSE PROJECT" AND THE WINDOW'S X WHILE AN EXPORT IS WRITING
   During a long export (isSaving on) the Save and Export buttons are off, but "Close project" was
   not: with unsaved edits, "Save and close" started a save that half a second later switched off
   the bar of the export still running. From the window's X it was worse: with no edits the window
   closed at once, mid-archive, with no question (and the half-written archive was lost). Now "Close
   project" is off while writing, "Save and close" waits, and in Electron the first X during a write
   stops and says to wait: a second X closes anyway, as the notice says.
   The REAL texts of the effect listening for the close and of handleSaveAndCloseProject, taken
   from src/App.tsx, are run with the real rules of src/utils/closeGuard.ts and the real strings of
   src/constants.ts (compiled with esbuild); the button is read from src/App.tsx.
   Usage:  node scripts/test-close-during-write.mjs      (exits with code 1 if anything is off) */

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
const t = (await carica('src/constants.ts')).translations.en;
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const manca = (cosa) => { console.log('NO  non trovato in src/App.tsx: ' + cosa); console.log('\nPROBLEMI: 1 (1 controlli)'); process.exit(1); };

console.log('\n--- il tasto "Chiudi progetto" mentre si scrive ---');
{
    const m = sorgente.match(/<button onClick=\{handleCloseProject\}[^>]*?disabled=\{([^}]*)\}/);
    dice('si spegne con isSaving, come Salva ed Esporta', true, !!m && /\bisSaving\b/.test(m[1]));
}

const iAscolto = sorgente.indexOf("window.addEventListener('beforeunload'");
if (iAscolto < 0) manca("window.addEventListener('beforeunload', ...)");
const iEffetto = sorgente.lastIndexOf('    useEffect(() => {', iAscolto);
const fineEffetto = /\r?\n    \}, \[[^\]]*\]\);\r?\n/g;
fineEffetto.lastIndex = iAscolto;
const mEffetto = fineEffetto.exec(sorgente);
if (iEffetto < 0 || !mEffetto) manca("l'effetto di beforeunload");
const testoEffetto = sorgente.slice(iEffetto + '    useEffect('.length, mEffetto.index + mEffetto[0].indexOf(','));
const ritaglia = (intestazione) => {
    const inizio = sorgente.indexOf(intestazione);
    if (inizio < 0) manca(intestazione.trim());
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = inizio;
    const fine = chiusura.exec(sorgente);
    if (!fine) manca(intestazione.trim());
    return sorgente.slice(inizio, fine.index + fine[0].length);
};
const pezzi = ['const effettoChiusura = ' + testoEffetto + ';', ritaglia('    const chiudiFinestraSeRichiesto = '), ritaglia('    const handleSaveAndCloseProject = async ')];
const codice = (await esbuild.transform(pezzi.join('\n'), { loader: 'ts' })).code;
// ITALIANO: ogni ref letto dai pezzi parte da false, come un useRef; quelli che servono si impostano sotto.
// ENGLISH: every ref the pieces read starts at false, like a useRef; the needed ones are set below.
const nomiRef = [...new Set(pezzi.join('\n').match(/\b\w+Ref\b/g) || [])];
const NOMI = ['window', 'localStorage', 'dirHandle', 'scriviBackupSubito', 'modificheNonSalvate', 'setTimeout', 'setIsTagEditorOpen',
    'setSaveCloseDialog', 'showNotification', 't', 'handleSaveChanges', 'closeProjectNow', 'console', ...nomiRef];
const fabbrica = new Function(...NOMI, codice + '\nreturn { effettoChiusura, handleSaveAndCloseProject };');

const foto = (name, tags, originalTags) => ({ id: name, file: { name }, tags, originalTags, backupKey: 'E:\\d\x1f' + name, lottoImport: 'l1', cartellaImport: 'd' });
const app = ({ immagini, scrittura, electron = true }) => {
    const a = { ascoltatori: [], notifiche: [], salvataggi: 0, chiusi: 0, finestra: { isOpen: false, isSaving: false }, archivio: new Map() };
    const win = {
        electronAPI: electron ? {} : undefined,
        addEventListener: (tipo, fn) => { if (tipo === 'beforeunload') a.ascoltatori.push(fn); },
        removeEventListener: () => { },
        close: () => { a.chiusi++; },
    };
    const memoria = { getItem: (k) => (a.archivio.has(k) ? a.archivio.get(k) : null), setItem: (k, v) => a.archivio.set(k, String(v)), removeItem: (k) => a.archivio.delete(k) };
    a.refs = {};
    for (const n of nomiRef) a.refs[n] = { current: false };
    a.refs.imagesRef = { current: immagini };
    a.refs.fotoChiuseRef = { current: new Map() };
    a.refs.globalTriggersRef = { current: [] };
    a.refs.saveCloseDialogRef = { current: a.finestra };
    if (a.refs.isSavingRef) a.refs.isSavingRef.current = scrittura;
    const f = fabbrica(win, memoria, null, G.scriviBackupSubito, G.modificheNonSalvate, setTimeout, () => { },
        (d) => { a.finestra = d; a.refs.saveCloseDialogRef.current = d; }, (m, tipo) => a.notifiche.push([m, tipo]), t,
        async () => { a.salvataggi++; return true; }, () => { }, { error() { } }, ...nomiRef.map(n => a.refs[n]));
    f.effettoChiusura();
    a.salvaEChiudi = f.handleSaveAndCloseProject;
    a.chiudi = () => {
        const e = { defaultPrevented: false, returnValue: undefined, preventDefault() { this.defaultPrevented = true; } };
        for (const fn of a.ascoltatori) fn(e);
        return e.defaultPrevented;
    };
    return a;
};
const attendi = () => new Promise((r) => setTimeout(r, 5));
const testo = (k) => (typeof t[k] === 'string' && t[k].length > 0 ? t[k] : '(manca ' + k + ' in constants.ts)');

dice('premessa: la chiusura e "Salva e chiudi" sanno se si sta scrivendo (isSavingRef)', true, nomiRef.includes('isSavingRef'));

console.log('\n--- X della finestra mentre un\'esportazione scrive ---');
{
    const a = app({ immagini: [foto('a.png', ['x'], ['x'])], scrittura: true });
    dice('senza modifiche: la prima X si ferma (prima si chiudeva a meta\' archivio)', true, a.chiudi());
    await attendi();
    dice('...e l\'avviso dice di aspettare o di chiudere di nuovo', [[testo('closeWhileWriting'), 'info']], a.notifiche);
    dice('...una seconda X chiude comunque', false, a.chiudi());
    const b = app({ immagini: [foto('a.png', ['x', 'nuovo'], ['x'])], scrittura: true });
    b.chiudi();
    await attendi();
    dice('con modifiche: la prima X non apre la finestra a tre scelte', false, b.finestra.isOpen);
}

console.log('\n--- "Salva e chiudi" mentre un\'esportazione scrive ---');
{
    const a = app({ immagini: [foto('a.png', ['x', 'nuovo'], ['x'])], scrittura: true });
    a.finestra = { isOpen: true, isSaving: false };
    await a.salvaEChiudi();
    dice('non salva (la barra resta dell\'esportazione), la finestra resta aperta e dice di riprovare dopo',
        [0, 0, { isOpen: true, isSaving: false }, [[testo('saveWaitForWrite'), 'info']]], [a.salvataggi, a.chiusi, a.finestra, a.notifiche]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const a = app({ immagini: [foto('a.png', ['x'], ['x'])], scrittura: false });
    dice('niente in scrittura, niente modifiche: la X chiude subito', false, a.chiudi());
    const b = app({ immagini: [foto('a.png', ['x', 'nuovo'], ['x'])], scrittura: false });
    dice('niente in scrittura, con modifiche: la X si ferma', true, b.chiudi());
    await attendi();
    dice('...e compare la finestra a tre scelte, senza l\'avviso della scrittura', [true, []], [b.finestra.isOpen, b.notifiche]);
    await b.salvaEChiudi();
    dice('"Salva e chiudi" senza scritture in corso salva e chiude', [1, 1], [b.salvataggi, b.chiusi]);
    const c = app({ immagini: [foto('a.png', ['x'], ['x'])], scrittura: true, electron: false });
    dice('anteprima del browser: non si ferma niente, come prima', false, c.chiudi());
}

process.exit(esito());
