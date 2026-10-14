/* ITALIANO: PROVA DEL BACKUP ANTI-CRASH QUANDO SI CHIUDE L'ULTIMA FOTO
   Una foto con modifiche non salvate veniva chiusa con la X, confermando "le modifiche andranno
   perse". Se era l'ultima foto in vista, l'effetto che scrive il backup si fermava subito ("lista
   vuota = avvio del programma, non si tocca") e il backup restava con le modifiche buttate via.
   Ricaricando la stessa foto l'import diceva "recuperate dal backup", le rimetteva sulla foto e il
   primo "Salva" le scriveva nel .txt. Con altre foto ancora in vista invece il backup si
   ricalcolava e la foto chiusa ne usciva. La regola: la lista vuota si lascia stare solo
   all'avvio, prima che una foto sia mai entrata; dopo, una lista vuota vuol dire che l'utente le
   ha chiuse, e il backup si ricalcola come sempre.
   Si esegue il testo VERO dell'effetto preso da src/App.tsx, con le regole vere di
   src/utils/closeGuard.ts e src/utils/tagBackup.ts (compilati con esbuild) e un localStorage finto.
   Uso:  node scripts/test-backup-closed-last.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE CRASH BACKUP WHEN THE LAST PHOTO IS CLOSED
   A photo with unsaved edits was closed with the X, confirming "the changes will be lost". If it
   was the last photo in view, the effect that writes the backup stopped at once ("empty list =
   program start, leave it alone") and the backup kept the discarded edits. Loading the same photo
   again, the import said "recovered from the backup", put them back on the photo and the first
   "Save" wrote them to the .txt. With other photos still in view the backup was recomputed instead
   and the closed photo left it. The rule: the empty list is left alone only at start-up, before
   any photo has ever been loaded; afterwards an empty list means the user closed them, and the
   backup is recomputed as always.
   The REAL text of the effect taken from src/App.tsx is run, with the real rules of
   src/utils/closeGuard.ts and src/utils/tagBackup.ts (compiled with esbuild) and a fake
   localStorage.
   Usage:  node scripts/test-backup-closed-last.mjs      (exits with code 1 if anything is off) */

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
const B = await carica('src/utils/tagBackup.ts');
const G = await carica('src/utils/closeGuard.ts');
const { dice, esito } = creaControlli();

// ITALIANO: l'effetto vero che scrive il backup, dalla sua riga useEffect alla riga delle dipendenze.
// ENGLISH: the real effect writing the backup, from its useEffect line to its dependency line.
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const iScrive = sorgente.indexOf('scriviBackupSubito(localStorage, images, fotoChiuseRef.current.values(), folder);');
const iInizio = iScrive < 0 ? -1 : sorgente.lastIndexOf('    useEffect(() => {', iScrive);
const iFine = iScrive < 0 ? -1 : sorgente.indexOf('    }, [images, dirHandle]);', iScrive);
if (iInizio < 0 || iFine < 0) { console.log('NO  l\'effetto del backup non trovato in src/App.tsx'); process.exit(1); }
const testo = sorgente.slice(iInizio + '    useEffect('.length, iFine + '    }'.length);
const js = (await esbuild.transform('const effettoBackup = ' + testo + ';', { loader: 'ts' })).code;
// ITALIANO: i ref che l'effetto legge oltre a fotoChiuseRef (il codice di prima non ne aveva):
//           ognuno parte da false e resta lo stesso fra un giro e l'altro, come un useRef.
// ENGLISH: the refs the effect reads besides fotoChiuseRef (the previous code had none): each one
//          starts at false and stays the same between runs, like a useRef.
const altriRef = [...new Set(testo.match(/\b\w+Ref\b/g) || [])].filter(n => n !== 'fotoChiuseRef');
const NOMI = ['images', 'dirHandle', 'localStorage', 'fotoChiuseRef', 'scriviBackupSubito', 'setTimeout', 'clearTimeout', ...altriRef];
const fabbrica = new Function(...NOMI, js + '\nreturn effettoBackup;');

const SEP = '\x1f';
const memoriaFinta = (iniziale = null) => {
    const m = new Map();
    if (iniziale !== null) m.set('tagBackup', iniziale);
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
};
// ITALIANO: l'app finta: a ogni cambio di `images` gira l'effetto; il timer di un secondo scatta subito.
// ENGLISH: the fake app: on every change of `images` the effect runs; the one-second timer fires at once.
const creaApp = (memoria, cartella = null) => {
    const refs = { fotoChiuseRef: { current: new Map() } };
    for (const n of altriRef) refs[n] = { current: false };
    const app = { images: [], memoria, refs };
    app.gira = () => {
        const effetto = fabbrica(app.images, cartella, memoria, refs.fotoChiuseRef, G.scriviBackupSubito,
            (f) => { f(); return 0; }, () => { }, ...altriRef.map(n => refs[n]));
        effetto();
    };
    app.imposta = (lista) => { app.images = lista; app.gira(); };
    // ITALIANO: la X confermata: come handleCloseImage, la foto entra in fotoChiuseRef ed esce dall'elenco.
    // ENGLISH: the confirmed X: as handleCloseImage does, the photo enters fotoChiuseRef and leaves the list.
    app.chiudi = (id) => {
        const img = app.images.find(i => i.id === id);
        refs.fotoChiuseRef.current.set(id, { id, name: img.file.name, lotto: String(img.lottoImport || ''), cartella: String(img.cartellaImport || '') });
        app.imposta(app.images.filter(i => i.id !== id));
    };
    return app;
};
const foto = (nome, tags, originalTags, cartella = '', percorso = 'E:\\foto') => ({
    id: nome, file: { name: nome }, tags, originalTags, backupKey: percorso + SEP + nome,
    lottoImport: 'L1', cartellaImport: cartella,
});
// ITALIANO: quello che fa l'import ricaricando la foto: trova la sua voce e decide se rimetterla.
// ENGLISH: what the import does when loading the photo again: finds its entry and decides whether to put it back.
const riapri = (memoria, cartella, nomi, nome, sulDisco, percorso = 'E:\\foto') => {
    const letto = B.backupDellImport(memoria.getItem('tagBackup'), cartella, B.folderSignature(cartella, nomi));
    const voce = letto ? letto.voci[percorso + SEP + nome] : undefined;
    return B.tagDaRipristinare(voce, sulDisco, sulDisco, [], undefined, letto ? letto.ts : null);
};

console.log('\n--- "Carica immagini" con una foto, modificata e chiusa con la X ---');
{
    const memoria = memoriaFinta();
    const app = creaApp(memoria);
    app.imposta([foto('p.png', ['a', 'b'], ['a', 'b'])]);
    dice('appena caricata, senza modifiche: nessun backup', null, memoria.getItem('tagBackup'));
    app.imposta([foto('p.png', ['a', 'b', 'wrong'], ['a', 'b'])]);
    dice('dopo la modifica il backup c\'e\'', true, memoria.getItem('tagBackup') !== null);
    app.chiudi('p.png');
    dice('chiusa l\'ultima foto confermando "le modifiche andranno perse": il backup sparisce', null, memoria.getItem('tagBackup'));
    dice('ricaricando la stessa foto non torna niente: restano i tag del .txt', null, riapri(memoria, '', ['p.png'], 'p.png', ['a', 'b']));
}

console.log('\n--- una cartella con due foto modificate, chiuse tutte e due ---');
{
    const memoria = memoriaFinta();
    const app = creaApp(memoria, { name: 'dataset' });
    const a = foto('a.png', ['x', 'bad'], ['x'], 'dataset', 'E:\\dataset');
    const b = foto('b.png', ['y', 'bad'], ['y'], 'dataset', 'E:\\dataset');
    app.imposta([a, b]);
    app.chiudi('a.png');
    dice('chiusa la prima: nel backup resta solo b.png (come prima)', [['E:\\dataset' + SEP + 'b.png']],
        JSON.parse(memoria.getItem('tagBackup')).sources.map(s => Object.keys(s.data)));
    app.chiudi('b.png');
    dice('chiusa anche l\'ultima: il backup sparisce', null, memoria.getItem('tagBackup'));
    dice('riaprendo la cartella b.png tiene il suo .txt', null, riapri(memoria, 'dataset', ['a.png', 'b.png'], 'b.png', ['y'], 'E:\\dataset'));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    // ITALIANO: all'avvio la lista e' vuota: il backup di un crash resta li', e' il suo momento.
    // ENGLISH: at start-up the list is empty: a crash backup stays put, this is its moment.
    const crash = JSON.stringify({ ts: 1, folder: 'dataset', sources: [{ signature: B.folderSignature('dataset', ['a.png']), data: { ['E:\\dataset' + SEP + 'a.png']: { tags: ['x', 'y'], base: B.improntaTag(['x']) } } }] });
    const memoria = memoriaFinta(crash);
    const app = creaApp(memoria);
    app.gira();
    dice('all\'avvio, con la lista vuota, il backup di un crash non si tocca', crash, memoria.getItem('tagBackup'));
    dice('e riaprendo la cartella le modifiche tornano', ['x', 'y'], riapri(memoria, 'dataset', ['a.png'], 'a.png', ['x'], 'E:\\dataset'));
}
{
    // ITALIANO: un crash con le modifiche di un'ALTRA cartella non ancora riaperta: chiudere
    //           l'ultima foto di questa sessione non le deve cancellare.
    // ENGLISH: a crash with the edits of ANOTHER folder not reopened yet: closing the last photo
    //          of this session must not delete them.
    const altra = { signature: B.folderSignature('altra', ['z.png']), data: { ['E:\\altra' + SEP + 'z.png']: { tags: ['k', 'm'], base: B.improntaTag(['k']) } } };
    const memoria = memoriaFinta(JSON.stringify({ ts: 1, folder: 'altra', sources: [altra] }));
    const app = creaApp(memoria);
    app.gira();
    app.imposta([foto('p.png', ['a', 'wrong'], ['a'])]);
    app.chiudi('p.png');
    dice('chiusa l\'ultima foto: resta solo il recupero dell\'altra cartella', [altra.signature],
        (JSON.parse(memoria.getItem('tagBackup') || '{"sources":[]}').sources || []).map(s => s.signature));
    dice('e l\'altra cartella si recupera ancora', ['k', 'm'], riapri(memoria, 'altra', ['z.png'], 'z.png', ['k'], 'E:\\altra'));
}
{
    // ITALIANO: con una foto ancora in vista il backup si ricalcolava gia' (era il caso giusto).
    // ENGLISH: with a photo still in view the backup was already recomputed (that was the right case).
    const memoria = memoriaFinta();
    const app = creaApp(memoria);
    app.imposta([foto('p.png', ['a', 'wrong'], ['a']), foto('q.png', ['c', 'nuovo'], ['c'])]);
    app.chiudi('p.png');
    dice('chiusa una foto su due: la modifica non salvata dell\'altra resta nel backup', ['c', 'nuovo'],
        riapri(memoria, '', ['p.png', 'q.png'], 'q.png', ['c']));
}

process.exit(esito());
