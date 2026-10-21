/* ITALIANO: PROVA: FOTO CHIUSA CON LA X, RIAPERTA E POI TOLTA DAL DISCO: LA COPIA CHIUSA SE NE VA CON LEI
   Si chiude a.png con la X della card (resta fra le chiuse e nei passi della cronologia), si
   riapre la cartella e a.png rientra con un id nuovo. Cestinando e svuotando la copia nuova, il
   file finisce nel Cestino di Windows, ma la copia chiusa (un altro id, lo STESSO file) restava fra
   le chiuse e nella cronologia: un Ctrl+Z la rimetteva in galleria senza file (Salva poteva creare
   un a.txt orfano) e continuava a contare nell'impronta del backup. Ora, quando una foto lascia il
   disco (Svuota Cestino, la X nel cestino, la cancellazione definitiva), se ne vanno anche le copie
   chiuse dello stesso file: stesso nome intero (senza maiuscole) e stesso percorso, oppure, senza
   percorsi, la stessa cartella aperta.
   Casi vicini che non devono cambiare: una foto chiusa con lo stesso nome in un'altra cartella
   resta; una foto chiusa diversa resta; una copia chiusa riportata in galleria con Ctrl+Z (quindi
   di nuovo nell'elenco) non sparisce da sola.
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-closed-copy-emptied.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: A PHOTO CLOSED WITH THE X, REOPENED AND THEN TAKEN OFF THE DISK: THE CLOSED COPY GOES WITH IT
   a.png is closed with the card's X (it stays among the closed photos and in the history steps),
   the folder is reopened and a.png comes back with a new id. Trashing and emptying the new copy
   sends the file to the Windows Recycle Bin, but the closed copy (another id, the SAME file)
   stayed among the closed photos and in the history: one Ctrl+Z put it back in the gallery with no
   file (Save could create an orphan a.txt) and it kept counting in the backup fingerprint. Now,
   when a photo leaves the disk (Empty Trash, the X in the trash, the permanent delete), the closed
   copies of the same file leave too: same whole name (ignoring case) and same path, or, with no
   paths, the same open folder.
   Neighbouring cases that must not change: a closed photo with the same name in another folder
   stays; a different closed photo stays; a closed copy brought back to the gallery with Ctrl+Z
   (so in the list again) does not vanish by itself.
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-closed-copy-emptied.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, cartellaFinta, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const B = String.fromCharCode(92);
const D = 'E:' + B + 'dataset' + B;
const ALTRA = 'F:' + B + 'altro' + B;
const foto = (id, nome, { cartella = D, cestinata = false, dirHandle = null } = {}) => ({ id, file: { name: nome, percorso: cartella ? cartella + nome : '' },
    thumb: 'blob:x/' + id, tags: ['cat'], originalTags: ['cat'], isTrashed: cestinata, dirHandle });
// ITALIANO: come handleCloseImage: la foto va fra le chiuse ed esce dalla galleria (diventa un passo).
// ENGLISH: like handleCloseImage: the photo goes among the closed ones and leaves the gallery (a step).
const chiudi = async (app, f) => {
    app.refs.fotoChiuseRef.current.set(f.id, { id: f.id, name: f.file.name, lotto: '', cartella: '', foto: f });
    app.modifica(prev => prev.filter(i => i.id !== f.id));
    await app.attendi();
};
const chiuse = (app) => [...app.refs.fotoChiuseRef.current.keys()].sort();
const tantiCtrlZ = async (app, n = 4) => {
    const viste = [];
    for (let i = 0; i < n; i++) { app.render().handleUndo(); await app.attendi(10); viste.push(app.vista().join(',')); }
    return viste;
};

console.log('\n--- chiusa, riaperta, cestinata, Svuota Cestino ---');
{
    const vecchia = foto('A_vecchia', 'a.png');
    const omonimaAltrove = foto('X_altrove', 'a.png', { cartella: ALTRA });
    const diversa = foto('C', 'c.png');
    const app = creaApp([vecchia, foto('B', 'b.png'), omonimaAltrove, diversa], { api: apiFinta() });
    await app.attendi();
    await chiudi(app, vecchia);
    await chiudi(app, omonimaAltrove);
    await chiudi(app, diversa);
    app.modifica(prev => [...prev, foto('A_nuova', 'a.png')]);
    await app.attendi();
    app.cestina('A_nuova');
    await app.attendi();
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    dice('premessa: a.png e\' andata nel Cestino di Windows, in galleria resta B', ['B'], app.vista());
    dice('la copia chiusa dello stesso file non e\' piu\' fra le chiuse; restano l\'omonima altrove e la diversa', ['C', 'X_altrove'], chiuse(app));
    const viste = await tantiCtrlZ(app);
    dice('nessun Ctrl+Z rimette in galleria la copia chiusa (il suo file e\' nel Cestino)', false, viste.some(v => v.includes('A_vecchia')));
    dice('...mentre l\'omonima di un\'altra cartella torna ancora con Ctrl+Z', true, viste.some(v => v.includes('X_altrove')));
}

console.log('\n--- maiuscole diverse nel nome: e\' lo stesso file per Windows ---');
{
    const vecchia = foto('A_vecchia', 'A.PNG');
    const app = creaApp([vecchia, foto('B', 'b.png')], { api: apiFinta() });
    await app.attendi();
    await chiudi(app, vecchia);
    app.modifica(prev => [...prev, foto('A_nuova', 'a.png')]);
    await app.attendi();
    app.cestina('A_nuova');
    await app.attendi();
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    dice('A.PNG chiusa se ne va con a.png svuotata', [], chiuse(app));
}

console.log('\n--- la X di una sola foto nel cestino ---');
{
    const vecchia = foto('A_vecchia', 'a.png');
    const app = creaApp([vecchia, foto('B', 'b.png')], { api: apiFinta() });
    await app.attendi();
    await chiudi(app, vecchia);
    app.modifica(prev => [...prev, foto('A_nuova', 'a.png')]);
    await app.attendi();
    app.cestina('A_nuova');
    await app.attendi();
    await app.render().handleDeletePermanently('A_nuova');
    await app.attendi(10);
    dice('premessa: la foto e\' uscita', ['B'], app.vista());
    dice('la copia chiusa non e\' piu\' fra le chiuse', [], chiuse(app));
    dice('...e nessun Ctrl+Z la rimette in galleria', false, (await tantiCtrlZ(app)).some(v => v.includes('A_vecchia')));
}

console.log('\n--- cancellazione definitiva (anteprima nel browser, senza percorsi: decide la cartella) ---');
{
    const cartella = cartellaFinta();
    const altraCartella = cartellaFinta();
    const vecchia = foto('A_vecchia', 'a.png', { cartella: '', dirHandle: cartella });
    const omonimaAltrove = foto('X_altrove', 'a.png', { cartella: '', dirHandle: altraCartella });
    const app = creaApp([vecchia, foto('B', 'b.png', { cartella: '', dirHandle: cartella }), omonimaAltrove]);
    await app.attendi();
    await chiudi(app, vecchia);
    await chiudi(app, omonimaAltrove);
    app.modifica(prev => [...prev, foto('A_nuova', 'a.png', { cartella: '', dirHandle: cartella })]);
    await app.attendi();
    app.cestina('A_nuova');
    await app.attendi();
    await app.render().handleEmptyTrash();
    await app.attendi();
    await app.stato.confirmDialog.onConfirm();
    await app.attendi(10);
    dice('premessa: a.png cancellata per sempre dalla cartella', ['a.png'], cartella.rimossi.filter(n => n.endsWith('.png')));
    dice('la copia chiusa della stessa cartella se ne va, quella di un\'altra cartella resta', ['X_altrove'], chiuse(app));
    dice('...e nessun Ctrl+Z la rimette in galleria', false, (await tantiCtrlZ(app)).some(v => v.includes('A_vecchia')));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    // ITALIANO: la copia chiusa riportata con Ctrl+Z e' di nuovo nell'elenco: non sparisce da sola.
    // ENGLISH: the closed copy brought back with Ctrl+Z is in the list again: it does not vanish by itself.
    const vecchia = foto('A_vecchia', 'a.png');
    const app = creaApp([vecchia, foto('B', 'b.png')], { api: apiFinta() });
    await app.attendi();
    await chiudi(app, vecchia);
    app.render().handleUndo();
    await app.attendi(10);
    dice('premessa: Ctrl+Z riporta la foto chiusa', ['A_vecchia', 'B'], app.vista());
    app.modifica(prev => [...prev, foto('A_nuova', 'a.png')]);
    await app.attendi();
    app.cestina('A_nuova');
    await app.attendi();
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    dice('la copia in galleria resta in galleria (non si tocca un elenco che l\'utente vede)', ['A_vecchia', 'B'], app.vista());
    dice('...con il suo messaggio di riuscita', true, app.notifiche.some(([m]) => m === t.deleteSuccess));
}

process.exit(esito());
