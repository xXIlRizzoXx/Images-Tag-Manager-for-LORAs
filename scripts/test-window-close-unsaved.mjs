/* ITALIANO: PROVA DELLA CHIUSURA DELLA FINESTRA (X, Alt+F4) CON MODIFICHE NON SALVATE
   "Chiudi progetto" con modifiche non salvate chiede Salva e chiudi / Chiudi senza salvare /
   Annulla. La X della finestra e Alt+F4 invece chiudevano subito: i .txt restavano coi tag vecchi
   e una modifica fatta meno di un secondo prima (un'aggiunta in blocco e poi la X) non finiva
   nemmeno nel backup anti-crash, perche' il suo timer moriva con la pagina.
   Ora, chiudendo la finestra, il backup si scrive SUBITO; in Electron, se ci sono modifiche non
   salvate, la chiusura si ferma e compare la stessa finestra a tre scelte. "Chiudi senza salvare"
   e un "Salva e chiudi" riuscito chiudono la finestra davvero; Annulla la lascia aperta. Nell'
   anteprima del browser non si ferma niente (si scrive solo il backup).
   Si eseguono i pezzi VERI di src/App.tsx (compilati con esbuild) con finti al posto della
   finestra, di React e di localStorage, e le regole vere di src/utils/closeGuard.ts.
   Uso:  node scripts/test-window-close-unsaved.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF CLOSING THE WINDOW (X, Alt+F4) WITH UNSAVED EDITS
   "Close project" with unsaved edits asks Save and close / Close without saving / Cancel. The
   window's X and Alt+F4 instead closed at once: the .txt files kept the old tags, and an edit made
   less than a second earlier (a bulk addition, then the X) did not even reach the crash backup,
   because its timer died with the page.
   Now, when the window closes, the backup is written AT ONCE; in Electron, with unsaved edits, the
   close stops and the same three-choice dialog shows. "Close without saving" and a successful
   "Save and close" really close the window; Cancel leaves it open. In the browser preview nothing
   is stopped (only the backup is written).
   The REAL pieces of src/App.tsx (compiled with esbuild) run with fakes in place of the window,
   React and localStorage, and the real rules of src/utils/closeGuard.ts.
   Usage:  node scripts/test-window-close-unsaved.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const manca = (cosa) => { console.log('NO  non trovato in src/App.tsx: ' + cosa); console.log('\nPROBLEMI: 1 (1 controlli)'); process.exit(1); };

// ITALIANO: l'effetto che ascolta la chiusura della finestra, dalla sua riga useEffect fino alle dipendenze.
// ENGLISH: the effect listening for the window close, from its useEffect line down to its dependencies.
const iAscolto = sorgente.indexOf("window.addEventListener('beforeunload'");
if (iAscolto < 0) manca("window.addEventListener('beforeunload', ...)");
const iEffetto = sorgente.lastIndexOf('    useEffect(() => {', iAscolto);
const fineEffetto = /\r?\n    \}, \[[^\]]*\]\);\r?\n/g;
fineEffetto.lastIndex = iAscolto;
const mEffetto = fineEffetto.exec(sorgente);
if (iEffetto < 0 || !mEffetto) manca("l'effetto di beforeunload");
const testoEffetto = 'const effettoChiusura = ' + sorgente.slice(iEffetto + '    useEffect('.length, mEffetto.index + mEffetto[0].indexOf(',')) + ';';
const ritaglia = (intestazione) => {
    const inizio = sorgente.indexOf(intestazione);
    if (inizio < 0) manca(intestazione.trim());
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = inizio;
    const fine = chiusura.exec(sorgente);
    if (!fine) manca(intestazione.trim());
    return sorgente.slice(inizio, fine.index + fine[0].length);
};
const pezzi = [
    testoEffetto,
    ritaglia('    const chiudiFinestraSeRichiesto = '),
    ritaglia('    const handleSaveAndCloseProject = async '),
    ritaglia('    const handleDiscardAndClose = '),
    ritaglia('    const handleCancelClose = '),
    ritaglia('    const handleCloseProject = () => {'),
];
const codice = (await esbuild.transform(pezzi.join('\n'), { loader: 'ts' })).code;
const u = await esbuild.build({ entryPoints: [path.join(radice, 'src/utils/closeGuard.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const G = await import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));

const NOMI = ['window', 'localStorage', 'imagesRef', 'fotoChiuseRef', 'dirHandle', 'permettiChiusuraRef', 'chiusuraFinestraRef',
    'saveCloseDialogRef', 'setSaveCloseDialog', 'setConfirmDialog', 'closeProjectNow', 'handleSaveChanges', 'showNotification', 't',
    'images', 'scriviBackupSubito', 'modificheNonSalvate', 'console', 'setTimeout'];
const fabbrica = new Function(...NOMI, codice + '\nreturn { effettoChiusura, chiudiFinestraSeRichiesto, handleSaveAndCloseProject, handleDiscardAndClose, handleCancelClose, handleCloseProject };');

const foto = (name, tags, originalTags, isTrashed = false) => ({
    id: name, file: { name }, tags, originalTags, isTrashed, backupKey: '\x1f' + name, lottoImport: 'l1', cartellaImport: '',
});
// ITALIANO: l'app finta: una finestra, uno storage, lo stato della finestra a tre scelte.
// ENGLISH: the fake app: a window, a storage, the three-choice dialog's state.
const app = ({ immagini, electron = true, salvataggio = true }) => {
    const a = { ascoltatori: [], chiusure: 0, progettoChiuso: 0, finestra: { isOpen: false, isSaving: false }, archivio: new Map() };
    a.window = {
        electronAPI: electron ? {} : undefined,
        addEventListener: (tipo, fn) => { if (tipo === 'beforeunload') a.ascoltatori.push(fn); },
        removeEventListener: (tipo, fn) => { a.ascoltatori = a.ascoltatori.filter((x) => x !== fn); },
        close: () => { a.chiusure++; a.chiudi(); },
    };
    a.localStorage = {
        getItem: (k) => (a.archivio.has(k) ? a.archivio.get(k) : null),
        setItem: (k, v) => a.archivio.set(k, String(v)),
        removeItem: (k) => a.archivio.delete(k),
    };
    const saveCloseDialogRef = { current: a.finestra };
    const setSaveCloseDialog = (d) => { a.finestra = d; saveCloseDialogRef.current = d; };
    a.refs = { permetti: { current: false }, chiusura: { current: false } };
    a.f = fabbrica(a.window, a.localStorage, { current: immagini }, { current: new Map() }, null, a.refs.permetti, a.refs.chiusura,
        saveCloseDialogRef, setSaveCloseDialog, () => {}, () => { a.progettoChiuso++; a.localStorage.removeItem('tagBackup'); },
        async () => salvataggio, () => {}, {}, immagini, G.scriviBackupSubito, G.modificheNonSalvate, { error() {} }, setTimeout);
    a.smonta = a.f.effettoChiusura();
    // ITALIANO: la finestra prova a chiudersi: true = chiusura fermata.
    // ENGLISH: the window tries to close: true = close stopped.
    a.chiudi = () => {
        const e = { defaultPrevented: false, returnValue: undefined, preventDefault() { this.defaultPrevented = true; } };
        for (const fn of a.ascoltatori) fn(e);
        a.ultimoEvento = e;
        return e.defaultPrevented;
    };
    return a;
};
const attendi = () => new Promise((r) => setTimeout(r, 5));
const tagNelBackup = (a) => {
    const g = a.archivio.get('tagBackup');
    if (!g) return null;
    const b = JSON.parse(g);
    return b.sources.flatMap((s) => Object.values(s.data).map((v) => v.tags));
};

console.log('\n--- X con una modifica fatta un attimo prima ---');
{
    const a = app({ immagini: [foto('a.png', ['x', 'nuovo'], ['x']), foto('b.png', ['y'], ['y'])] });
    const fermata = a.chiudi();
    dice('la chiusura si ferma', [true, false], [fermata, a.ultimoEvento.returnValue]);
    dice('il backup ha gia\' la modifica, senza aspettare il secondo', [['x', 'nuovo']], tagNelBackup(a));
    await attendi();
    dice('compare la finestra a tre scelte', { isOpen: true, isSaving: false }, a.finestra);
    a.f.handleDiscardAndClose();
    dice('"Chiudi senza salvare": progetto chiuso e finestra chiusa davvero', [1, 1], [a.progettoChiuso, a.chiusure]);
    dice('...e la seconda volta la chiusura non si ferma piu\'', false, a.ultimoEvento.defaultPrevented);
}

console.log('\n--- Annulla ---');
{
    const a = app({ immagini: [foto('a.png', ['x', 'nuovo'], ['x'])] });
    a.chiudi();
    await attendi();
    a.f.handleCancelClose();
    dice('la finestra resta aperta e il progetto pure', [0, 0, false], [a.chiusure, a.progettoChiuso, a.finestra.isOpen]);
    dice('una nuova X si ferma di nuovo', true, a.chiudi());
    await attendi();
    a.f.handleCancelClose();
    a.f.handleCloseProject();
    a.f.handleDiscardAndClose();
    dice('dopo Annulla, "Chiudi progetto" + "Chiudi senza salvare" chiude solo il progetto', [1, 0], [a.progettoChiuso, a.chiusure]);
}

console.log('\n--- Salva e chiudi ---');
{
    const a = app({ immagini: [foto('a.png', ['x', 'nuovo'], ['x'])] });
    a.chiudi();
    await attendi();
    await a.f.handleSaveAndCloseProject();
    dice('salvataggio riuscito: la finestra si chiude', 1, a.chiusure);
    const b = app({ immagini: [foto('a.png', ['x', 'nuovo'], ['x'])], salvataggio: false });
    b.chiudi();
    await attendi();
    await b.f.handleSaveAndCloseProject();
    dice('salvataggio fallito: la finestra resta aperta, con la domanda', [0, 0, true], [b.chiusure, b.progettoChiuso, b.finestra.isOpen]);
}

console.log('\n--- quando non c\'e\' niente da chiedere ---');
{
    const a = app({ immagini: [foto('a.png', ['x', 'nuovo'], ['x'], true), foto('b.png', ['y'], ['y'])] });
    dice('solo modifiche su foto nel cestino: si chiude subito', false, a.chiudi());
    await attendi();
    dice('...senza finestra a tre scelte', false, a.finestra.isOpen);
    const b = app({ immagini: [foto('a.png', ['x', 'nuovo'], ['x'])], electron: false });
    dice('anteprima del browser: non si ferma niente', false, b.chiudi());
    dice('...ma il backup si scrive lo stesso', [['x', 'nuovo']], tagNelBackup(b));
    b.smonta();
    dice('l\'ascolto si toglie quando l\'app si smonta (schermata d\'errore)', 0, b.ascoltatori.length);
}

console.log('\n--- stessa regola di "Chiudi progetto" ---');
for (const [titolo, immagini] of [
    ['foto attiva modificata', [foto('a.png', ['x', 'n'], ['x'])]],
    ['modifica solo nel cestino', [foto('a.png', ['x', 'n'], ['x'], true)]],
    ['nessuna modifica', [foto('a.png', ['x'], ['x'])]],
]) {
    const a = app({ immagini });
    a.f.handleCloseProject();
    dice(titolo + ': "Chiudi progetto" e la X decidono uguale', a.finestra.isOpen, G.modificheNonSalvate(immagini));
}

process.exit(esito());
