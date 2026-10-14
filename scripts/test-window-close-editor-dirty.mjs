/* ITALIANO: PROVA DELLA CHIUSURA DELLA FINESTRA CON L'EDITOR DEI FILE DI TAG MODIFICATO
   L'editor dei file di tag ha la sua X, che chiede prima di buttare via le modifiche non salvate.
   La X della finestra e Alt+F4 invece chiudevano subito il programma e la bozza spariva, anche
   senza nessuna foto aperta: la chiusura guardava solo le foto. La regola: in Electron, con l'editor
   modificato, la chiusura si ferma, l'editor resta in vista e un avviso dice di salvare o scartare
   prima. Con l'editor senza modifiche e foto da salvare compare la finestra a tre scelte di sempre,
   ma l'editor si mette via, perche' quella finestra sta sotto di lui. Nell'anteprima del browser
   non si ferma niente.
   Si esegue il testo VERO dell'effetto che ascolta la chiusura, preso da src/App.tsx, con le regole
   vere di src/utils/closeGuard.ts e i testi veri di src/constants.ts (compilati con esbuild).
   Uso:  node scripts/test-window-close-editor-dirty.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF CLOSING THE WINDOW WITH THE TAG FILE EDITOR EDITED
   The tag file editor has its own X, which asks before throwing unsaved edits away. The window's X
   and Alt+F4 instead closed the program at once and the draft was gone, with no photo open too: the
   close only looked at the photos. The rule: in Electron, with the editor edited, the close stops,
   the editor stays in view and a notice says to save or discard first. With the editor clean and
   photos to save the usual three-choice dialog shows, but the editor is put away, because that
   dialog sits below it. In the browser preview nothing is stopped.
   The REAL text of the effect listening for the close, taken from src/App.tsx, is run with the real
   rules of src/utils/closeGuard.ts and the real texts of src/constants.ts (compiled with esbuild).
   Usage:  node scripts/test-window-close-editor-dirty.mjs      (exits with code 1 if anything is off) */

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

const iAscolto = sorgente.indexOf("window.addEventListener('beforeunload'");
if (iAscolto < 0) manca("window.addEventListener('beforeunload', ...)");
const iEffetto = sorgente.lastIndexOf('    useEffect(() => {', iAscolto);
const fineEffetto = /\r?\n    \}, \[[^\]]*\]\);\r?\n/g;
fineEffetto.lastIndex = iAscolto;
const mEffetto = fineEffetto.exec(sorgente);
if (iEffetto < 0 || !mEffetto) manca("l'effetto di beforeunload");
const testo = 'const effettoChiusura = ' + sorgente.slice(iEffetto + '    useEffect('.length, mEffetto.index + mEffetto[0].indexOf(',')) + ';';
const codice = (await esbuild.transform(testo, { loader: 'ts' })).code;
const NOMI = ['window', 'localStorage', 'imagesRef', 'fotoChiuseRef', 'dirHandle', 'permettiChiusuraRef', 'chiusuraFinestraRef',
    'saveCloseDialogRef', 'setSaveCloseDialog', 'scriviBackupSubito', 'modificheNonSalvate', 'setTimeout',
    'tagEditorDirtyRef', 'globalTriggersRef', 'setIsTagEditorOpen', 'showNotification', 't'];
const fabbrica = new Function(...NOMI, codice + '\nreturn effettoChiusura;');

const foto = (name, tags, originalTags, extra = {}) => ({
    id: name, file: { name }, tags, originalTags, backupKey: 'E:\\dataset\x1f' + name, lottoImport: 'l1', cartellaImport: '', ...extra,
});
// ITALIANO: la finestra finta: chiudi() prova a chiuderla e torna true se la chiusura si e' fermata.
// ENGLISH: the fake window: chiudi() tries to close it and returns true if the close was stopped.
const app = ({ immagini = [], editorSporco = false, electron = true, trigger = [] }) => {
    const a = { ascoltatori: [], finestra: { isOpen: false, isSaving: false }, editorAperto: editorSporco, notifiche: [], archivio: new Map() };
    const win = {
        electronAPI: electron ? {} : undefined,
        addEventListener: (tipo, fn) => { if (tipo === 'beforeunload') a.ascoltatori.push(fn); },
        removeEventListener: () => { },
    };
    const memoria = { getItem: (k) => (a.archivio.has(k) ? a.archivio.get(k) : null), setItem: (k, v) => a.archivio.set(k, String(v)), removeItem: (k) => a.archivio.delete(k) };
    a.chiusuraFinestraRef = { current: false };
    const saveCloseDialogRef = { current: a.finestra };
    fabbrica(win, memoria, { current: immagini }, { current: new Map() }, null, { current: false }, a.chiusuraFinestraRef,
        saveCloseDialogRef, (d) => { a.finestra = d; saveCloseDialogRef.current = d; }, G.scriviBackupSubito, G.modificheNonSalvate, setTimeout,
        { current: editorSporco }, { current: trigger }, (v) => { a.editorAperto = typeof v === 'function' ? v(a.editorAperto) : v; },
        (m, tipo) => a.notifiche.push([m, tipo]), t)();
    a.chiudi = () => {
        const e = { defaultPrevented: false, returnValue: undefined, preventDefault() { this.defaultPrevented = true; } };
        for (const fn of a.ascoltatori) fn(e);
        a.evento = e;
        return e.defaultPrevented;
    };
    return a;
};
const attendi = () => new Promise((r) => setTimeout(r, 5));
const avviso = typeof t.tagEditorUnsavedOnWindowClose === 'string' && t.tagEditorUnsavedOnWindowClose.length > 0 ? t.tagEditorUnsavedOnWindowClose : '(testo mancante in constants.ts)';

console.log('\n--- editor modificato, nessuna foto aperta ---');
{
    const a = app({ editorSporco: true });
    dice('la chiusura si ferma', [true, false], [a.chiudi(), a.evento.returnValue]);
    await attendi();
    dice('l\'editor resta in vista e l\'avviso dice cosa fare', [true, [[avviso, 'info']]], [a.editorAperto, a.notifiche]);
    dice('niente finestra a tre scelte (il suo "Salva e chiudi" non salva l\'editor)', false, a.finestra.isOpen);
}

console.log('\n--- editor modificato e foto aperte ---');
{
    const a = app({ editorSporco: true, immagini: [foto('a.png', ['x'], ['x'])] });
    dice('foto senza modifiche: la chiusura si ferma lo stesso', true, a.chiudi());
    const b = app({ editorSporco: true, immagini: [foto('a.png', ['x', 'nuovo'], ['x'])] });
    dice('foto con modifiche: si ferma', true, b.chiudi());
    await attendi();
    dice('...prima la bozza dell\'editor: avviso, niente finestra a tre scelte, la X non chiudera\' da sola', [1, false, false],
        [b.notifiche.length, b.finestra.isOpen, b.chiusuraFinestraRef.current]);
    dice('...e il backup delle foto si scrive lo stesso', true, b.archivio.has('tagBackup'));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const a = app({});
    dice('editor senza modifiche e nessuna foto: si chiude subito', false, a.chiudi());
    const b = app({ editorSporco: true, electron: false });
    dice('anteprima del browser: non si ferma niente', false, b.chiudi());
    const c = app({ immagini: [foto('a.png', ['x', 'nuovo'], ['x'])] });
    c.editorAperto = true;
    dice('editor pulito e foto da salvare: si ferma', true, c.chiudi());
    await attendi();
    dice('...compare la finestra a tre scelte e l\'editor si mette via (lei sta sotto)', [true, false, true], [c.finestra.isOpen, c.editorAperto, c.chiusuraFinestraRef.current]);
    const d = app({ immagini: [foto('b.png', ['ohwx'], [], { baseTxtNonLetto: [] })], trigger: ['ohwx'] });
    dice('solo una trigger su una foto col .txt non letto: si chiude subito, come per Salva', false, d.chiudi());
}

console.log('\n--- l\'editor dice ad App quando ha modifiche ---');
{
    const editor = fs.readFileSync(path.join(radice, 'src/components/TagFileEditor.tsx'), 'utf8');
    dice('TagFileEditor riceve onDirtyChange', true, /export const TagFileEditor = \(\{[^}]*\bonDirtyChange\b/.test(editor));
    dice('...e lo chiama da un effetto su `dirty`', true, /useEffect\(\(\) => \{[^}]*onDirtyChange\(dirty\)[\s\S]{0,200}?\}, \[dirty, onDirtyChange\]\)/.test(editor));
    dice('App gli passa la funzione che aggiorna tagEditorDirtyRef', true, /<TagFileEditor[\s\S]{0,400}?onDirtyChange=\{segnaEditorSporco\}/.test(sorgente)
        && /const segnaEditorSporco = useCallback\(\(sporco: boolean\) => \{ tagEditorDirtyRef\.current = sporco; \}, \[\]\);/.test(sorgente));
}

process.exit(esito());
