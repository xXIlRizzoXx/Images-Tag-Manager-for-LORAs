/* ITALIANO: PROVA DELLA X DELLA FINESTRA CON LA DOMANDA «SOVRASCRIVERE?» APERTA
   «Salva Modifiche» chiede «Sovrascrivere?» se un .txt e' cambiato da fuori, e mentre aspetta la
   risposta tiene acceso isSaving. Chiudendo la finestra con la X in quel momento compariva
   closeWhileWriting: «Il programma sta ancora scrivendo dei file. Aspetta che la barra di avanzamento
   sparisca...». Ma non si scrive niente e la barra non sparisce da sola: aspetta la risposta. Ora la
   prima X dice di rispondere prima alla domanda (closeWhileAsking, nelle nove lingue); una seconda X
   chiude comunque, come per la scrittura (le modifiche sono gia' nel backup).
   Casi vicini che non devono cambiare: durante una scrittura vera (nessuna domanda aperta) resta
   closeWhileWriting; risposta data e scrittura in corso: di nuovo closeWhileWriting; nell'anteprima
   del browser non si ferma niente.
   Anche: X con la domanda aperta, risposta, poi X durante la scrittura vera: si ferma di nuovo e dice
   closeWhileWriting (prima chiudeva subito); la domanda del visualizzatore aperta durante un'esportazione
   (scrittura vera): la X dice closeWhileWriting, non closeWhileAsking.
   La domanda la apre il codice VERO (handleSaveChanges e confermaSovrascrittura, undo-harness.mjs); la
   X la gestisce il testo VERO dell'effetto beforeunload preso da src/App.tsx.
   Uso:  node scripts/test-close-during-save-prompt.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE WINDOW'S X WITH THE "OVERWRITE?" QUESTION OPEN
   "Save Changes" asks "Overwrite?" when a .txt changed from outside, and keeps isSaving on while
   waiting for the answer. Closing the window with the X at that moment showed closeWhileWriting:
   "Files are still being written. Wait until the progress bar is gone...". But nothing is being
   written and the bar does not go away by itself: it waits for the answer. Now the first X says to
   answer the question first (closeWhileAsking, in the nine languages); a second X closes anyway, as
   for a write (the edits are already in the backup).
   Neighbouring cases that must not change: during a real write (no question open) closeWhileWriting
   stays; answer given and write running: closeWhileWriting again; in the browser preview nothing is
   stopped.
   Also: X with the question open, answer, then X during the real write: it stops again and says
   closeWhileWriting (it used to close at once); the viewer's question open during an export (a real
   write): the X says closeWhileWriting, not closeWhileAsking.
   The question is opened by the REAL code (handleSaveChanges and confermaSovrascrittura,
   undo-harness.mjs); the X is handled by the REAL text of the beforeunload effect from src/App.tsx.
   Usage:  node scripts/test-close-during-save-prompt.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaApp } from './undo-harness.mjs';
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

// ITALIANO: l'effetto vero che ascolta la chiusura della finestra (come in test-close-during-write.mjs).
// ENGLISH: the real effect listening for the window close (as in test-close-during-write.mjs).
const iAscolto = sorgente.indexOf("window.addEventListener('beforeunload'");
if (iAscolto < 0) manca("window.addEventListener('beforeunload', ...)");
const iEffetto = sorgente.lastIndexOf('    useEffect(() => {', iAscolto);
const fineEffetto = /\r?\n    \}, \[[^\]]*\]\);\r?\n/g;
fineEffetto.lastIndex = iAscolto;
const mEffetto = fineEffetto.exec(sorgente);
if (iEffetto < 0 || !mEffetto) manca("l'effetto di beforeunload");
const testoEffetto = sorgente.slice(iEffetto + '    useEffect('.length, mEffetto.index + mEffetto[0].indexOf(','));
const codice = (await esbuild.transform('const effettoChiusura = ' + testoEffetto + ';', { loader: 'ts' })).code;
const nomiRef = [...new Set(testoEffetto.match(/\b\w+Ref\b/g) || [])];
const NOMI = ['window', 'localStorage', 'dirHandle', 'scriviBackupSubito', 'modificheNonSalvate', 'setTimeout', 'setIsTagEditorOpen',
    'setSaveCloseDialog', 'showNotification', 't', 'console', ...nomiRef];
const fabbrica = new Function(...NOMI, codice + '\nreturn effettoChiusura;');

// ITALIANO: la finestra finta; `domanda` = il ref vero della domanda aperta (dal banco), `scrittura` = isSaving.
// ENGLISH: the fake window; `domanda` = the real ref of the open question (from the bench), `scrittura` = isSaving.
// ITALIANO: `chiusura` = il ref vero chiusuraInScritturaRef del banco (la X gia' premuta), quando serve
//           condividerlo con le funzioni vere (la risposta alla domanda).
// ENGLISH: `chiusura` = the bench's real chiusuraInScritturaRef (the X already pressed), when it must be
//          shared with the real functions (the answer to the question).
const finestra = ({ immagini, scrittura, domanda = { current: null }, electron = true, chiusura = null }) => {
    const a = { ascoltatori: [], notifiche: [], finestra: { isOpen: false }, archivio: new Map() };
    const win = {
        electronAPI: electron ? {} : undefined,
        addEventListener: (tipo, fn) => { if (tipo === 'beforeunload') a.ascoltatori.push(fn); },
        removeEventListener: () => { },
        close: () => { },
    };
    const memoria = { getItem: (k) => (a.archivio.has(k) ? a.archivio.get(k) : null), setItem: (k, v) => a.archivio.set(k, String(v)), removeItem: (k) => a.archivio.delete(k) };
    a.refs = {};
    for (const n of nomiRef) a.refs[n] = { current: false };
    a.refs.imagesRef = { current: immagini };
    a.refs.fotoChiuseRef = { current: new Map() };
    a.refs.globalTriggersRef = { current: [] };
    a.refs.saveCloseDialogRef = { current: a.finestra };
    a.refs.isSavingRef = { current: scrittura };
    if (nomiRef.includes('domandaSovrascritturaRef')) a.refs.domandaSovrascritturaRef = domanda;
    if (chiusura) a.refs.chiusuraInScritturaRef = chiusura;
    fabbrica(win, memoria, null, G.scriviBackupSubito, G.modificheNonSalvate, setTimeout, () => { },
        (d) => { a.finestra = d; }, (m, tipo) => a.notifiche.push([m, tipo]), t, { error() { } }, ...nomiRef.map(n => a.refs[n]))();
    a.chiudi = () => {
        const e = { defaultPrevented: false, returnValue: undefined, preventDefault() { this.defaultPrevented = true; } };
        for (const fn of a.ascoltatori) fn(e);
        return e.defaultPrevented;
    };
    return a;
};
const attendi = () => new Promise((r) => setTimeout(r, 5));
const testo = (k) => (typeof t[k] === 'string' && t[k].length > 0 ? t[k] : '(manca ' + k + ' in constants.ts)');

// ITALIANO: la domanda aperta dal codice vero: a.txt riscritto da fuori, trigger nuova, Salva.
// ENGLISH: the question opened by the real code: a.txt rewritten from outside, new trigger, Save.
// ITALIANO: `lenta` = ms per chiudere ogni file scritto (una scrittura che dura, per premere la X nel mezzo).
// ENGLISH: `lenta` = ms to close every written file (a write that lasts, to press the X halfway).
const cartella = (voci, lenta = 0) => {
    const disco = new Map(Object.entries(voci));
    const nonCe = () => new DOMException('not found', 'NotFoundError');
    return {
        disco, name: 'dataset',
        getFileHandle: async (nome, o) => {
            if (!disco.has(nome) && !(o && o.create)) throw nonCe();
            return {
                getFile: async () => { if (!disco.has(nome)) throw nonCe(); return new File([disco.get(nome)], nome, { type: 'text/plain' }); },
                createWritable: async () => {
                    let s = '';
                    return { write: async (x) => { s += x; }, close: async () => { if (lenta) await new Promise(ok => setTimeout(ok, lenta)); disco.set(nome, s); } };
                },
            };
        },
    };
};
const c = cartella({ 'a.png': 'x', 'a.txt': 'cat,' });
const app = creaApp([{ id: 'a', file: { name: 'a.png' }, thumb: 'blob:a', tags: ['cat'], originalTags: ['cat'], isTrashed: false, dirHandle: c,
    backupKey: 'E:\\dataset\x1fa.png', lottoImport: 'l1', cartellaImport: 'dataset' }], { trigger: ['ohwx'] });
app.importa(); await app.attendi();
c.disco.set('a.txt', '1girl, outdoors,');
app.modifica(prev => prev.map(i => ({ ...i, tags: ['ohwx', ...i.tags] }))); await app.attendi();
const salvataggio = app.render().handleSaveChanges();
for (let i = 0; i < 40 && !(app.stato.confirmDialog && app.stato.confirmDialog.isOpen); i++) await app.attendi(1);
const conDomanda = app.stato.confirmDialog && app.stato.confirmDialog.isOpen;
const salvando = app.eventi.filter(([k]) => k === 'salvando').map(([, v]) => v).pop();
dice('premessa: «Sovrascrivere?» aperta e isSaving acceso', [true, true], [!!conDomanda, salvando]);
dice('premessa: la chiusura sa se c\'e\' la domanda aperta (domandaSovrascritturaRef)', true, nomiRef.includes('domandaSovrascritturaRef'));

console.log('\n--- X della finestra con la domanda «Sovrascrivere?» aperta ---');
{
    const lista = app.stato.images;
    const a = finestra({ immagini: lista, scrittura: true, domanda: app.refs.domandaSovrascritturaRef });
    dice('la prima X si ferma', true, a.chiudi());
    await attendi();
    dice('...e dice di rispondere alla domanda, non di aspettare la barra', [[testo('closeWhileAsking'), 'info']], a.notifiche);
    dice('...non apre la finestra a tre scelte', false, a.finestra.isOpen);
    dice('una seconda X chiude comunque, con le modifiche nel backup', [false, true], [a.chiudi(), String(a.archivio.get('tagBackup') || '').includes('ohwx')]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const a = finestra({ immagini: app.stato.images, scrittura: true });
    a.chiudi();
    await attendi();
    dice('scrittura vera senza domanda: resta closeWhileWriting', [[testo('closeWhileWriting'), 'info']], a.notifiche);
    // ITALIANO: risposta data (Annulla): la domanda non e' piu' aperta, e una X dopo parla di scrittura.
    // ENGLISH: answer given (Cancel): the question is no longer open, and a later X speaks of writing.
    app.stato.confirmDialog.onCancel();
    await salvataggio;
    const b = finestra({ immagini: app.stato.images, scrittura: true, domanda: app.refs.domandaSovrascritturaRef });
    b.chiudi();
    await attendi();
    dice('dopo la risposta: la X durante una scrittura dice closeWhileWriting', [[testo('closeWhileWriting'), 'info']], b.notifiche);
    const d = finestra({ immagini: app.stato.images, scrittura: true, domanda: { current: { dialogo: {}, prima: {}, risolvi() { } } }, electron: false });
    dice('anteprima del browser: non si ferma niente, come prima', false, d.chiudi());
}

// ITALIANO: X con la domanda aperta, poi la risposta (Sovrascrivi), poi una X durante la scrittura vera.
//           La prima X aveva acceso chiusuraInScritturaRef; isSaving passa da spento ad acceso nello stesso
//           giro (la fine della rilettura e l'inizio di performSave), nessun render lo rimetteva a falso e
//           la X durante la scrittura chiudeva subito, senza l'avviso «aspetta la barra».
// ENGLISH: X with the question open, then the answer (Overwrite), then an X during the real write. The
//          first X had set chiusuraInScritturaRef; isSaving goes off and on in the same batch (end of the
//          re-read and start of performSave), no render set it back to false and the X during the write
//          closed at once, without the "wait for the bar" notice.
console.log('\n--- X con la domanda aperta, risposta, poi X durante la scrittura ---');
for (const [risposta, nome] of [['onConfirm', 'Sovrascrivi'], ['onCancel', 'Annulla (si scrive l\'altra foto)']]) {
    const c2 = cartella({ 'a.png': 'x', 'a.txt': 'cat,', 'b.png': 'x', 'b.txt': 'dog,' }, 150);
    const fotoB = (id, tag) => ({ id, file: { name: id + '.png' }, thumb: 'blob:' + id, tags: [tag], originalTags: [tag], isTrashed: false, dirHandle: c2 });
    const app2 = creaApp([fotoB('a', 'cat'), fotoB('b', 'dog')], { trigger: ['ohwx'] });
    app2.importa(); await app2.attendi();
    c2.disco.set('a.txt', '1girl, outdoors,');
    app2.modifica(prev => prev.map(i => ({ ...i, tags: ['ohwx', ...i.tags] }))); await app2.attendi();
    const p2 = app2.render().handleSaveChanges();
    for (let i = 0; i < 40 && !(app2.stato.confirmDialog && app2.stato.confirmDialog.isOpen); i++) await app2.attendi(1);
    const chiusura = app2.refs.chiusuraInScritturaRef;
    const a = finestra({ immagini: app2.stato.images, scrittura: true, domanda: app2.refs.domandaSovrascritturaRef, chiusura });
    dice(`${nome}: la prima X con la domanda aperta si ferma e dice di rispondere`, [true, [[testo('closeWhileAsking'), 'info']]],
        [a.chiudi(), await attendi().then(() => a.notifiche)]);
    app2.stato.confirmDialog[risposta]();
    await app2.attendi();
    const scrive = app2.eventi.filter(([k]) => k === 'salvando').map(([, v]) => v).pop();
    const b = finestra({ immagini: app2.stato.images, scrittura: true, domanda: app2.refs.domandaSovrascritturaRef, chiusura });
    const fermata = b.chiudi();
    await attendi();
    dice(`${nome}: durante la scrittura una sola X non chiude, e dice di aspettare la barra`, [true, true, [[testo('closeWhileWriting'), 'info']]],
        [scrive, fermata, b.notifiche]);
    dice(`${nome}: una seconda X chiude comunque, come promette l'avviso`, false, b.chiudi());
    await p2;
    await new Promise(ok => setTimeout(ok, 600));
}

// ITALIANO: la domanda del visualizzatore («Salva file .txt», che non accende isSaving) aperta mentre
//           un'esportazione scrive davvero (isSaving acceso da lei): la X diceva «aspetta la tua risposta»
//           e taceva la scrittura in corso. Ora dice closeWhileWriting; rispondere al visualizzatore non
//           riarma la X (la seconda chiude, come promesso).
// ENGLISH: the viewer's question ("Save .txt file", which does not turn isSaving on) open while an export
//          is really writing (isSaving on because of it): the X said "waiting for your answer" and kept
//          quiet about the write in progress. Now it says closeWhileWriting; answering the viewer does not
//          re-arm the X (the second one closes, as promised).
console.log('\n--- domanda del visualizzatore aperta durante un\'esportazione ---');
{
    const c3 = cartella({ 'a.png': 'x', 'a.txt': 'cat,' });
    const app3 = creaApp([{ id: 'a', file: { name: 'a.png' }, thumb: 'blob:a', tags: ['cat'], originalTags: ['cat'], isTrashed: false, dirHandle: c3 }], { trigger: [] });
    app3.importa(); await app3.attendi();
    c3.disco.set('a.txt', '1girl, outdoors,');
    const visualizzatore = app3.render().confermaSovrascrittura([app3.fotoCon('a')]);
    for (let i = 0; i < 40 && !(app3.stato.confirmDialog && app3.stato.confirmDialog.isOpen); i++) await app3.attendi(1);
    dice('premessa: la domanda del visualizzatore e\' aperta', true, !!app3.stato.confirmDialog.isOpen && app3.refs.domandaSovrascritturaRef.current !== null);
    const chiusura = app3.refs.chiusuraInScritturaRef;
    const a = finestra({ immagini: app3.stato.images, scrittura: true, domanda: app3.refs.domandaSovrascritturaRef, chiusura });
    const fermata = a.chiudi();
    await attendi();
    dice('la prima X si ferma e dice che si stanno scrivendo dei file (closeWhileWriting)', [true, [[testo('closeWhileWriting'), 'info']]], [fermata, a.notifiche]);
    app3.stato.confirmDialog.onCancel();
    await visualizzatore;
    const b = finestra({ immagini: app3.stato.images, scrittura: true, domanda: app3.refs.domandaSovrascritturaRef, chiusura });
    dice('...risposta data al visualizzatore, esportazione ancora in corso: la seconda X chiude', false, b.chiudi());
}

console.log('\n--- la frase nelle nove lingue ---');
for (const [lingua, tl] of Object.entries(lingue)) {
    dice(`${lingua}: closeWhileAsking c'e' ed e' diversa da closeWhileWriting`, true,
        typeof tl.closeWhileAsking === 'string' && tl.closeWhileAsking.trim() !== '' && tl.closeWhileAsking !== tl.closeWhileWriting);
}

process.exit(esito());
