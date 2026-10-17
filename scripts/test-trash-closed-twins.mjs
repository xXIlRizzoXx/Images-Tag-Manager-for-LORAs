/* ITALIANO: PROVA: DUE GEMELLE a.png/a.jpg CHIUSE CON LA X, RIAPERTE E POI SVUOTATE: a.txt PARTE CON LORO
   a.png e a.jpg nella stessa cartella usano lo stesso a.txt. Si chiudono tutte e due con la X della
   card, si riapre la cartella (rientrano con id nuovi, nell'ordine della cartella: a.jpg, poi a.png),
   si cestinano tutte e due e si svuota. Le immagini andavano nel Cestino di Windows ma a.txt restava
   nella cartella, orfano: per l'ultima foto, la copia CHIUSA dell'altra (id vecchio, lo stesso file
   della foto appena tolta) contava ancora come "un'altra foto che usa a.txt". Lo stesso con la
   cancellazione definitiva. Ora una copia chiusa non conta se e' lo stesso file di una foto gia'
   tolta nella stessa operazione (stesso nome intero e stesso percorso; senza percorsi, la stessa
   cartella aperta).
   Casi vicini che non devono cambiare: una sola gemella chiusa e riaperta, nessuna chiusa (a.txt
   parte); la copia chiusa di una gemella che NON e' stata tolta tiene ancora a.txt sul disco.
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-trash-closed-twins.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: TWO TWINS a.png/a.jpg CLOSED WITH THE X, REOPENED AND THEN EMPTIED: a.txt LEAVES WITH THEM
   a.png and a.jpg in the same folder use the same a.txt. Both are closed with the card's X, the
   folder is reopened (they come back with new ids, in folder order: a.jpg, then a.png), both are
   trashed and the trash is emptied. The images went to the Windows Recycle Bin but a.txt stayed in
   the folder, orphaned: for the last photo, the CLOSED copy of the other one (old id, the same file
   as the photo just removed) still counted as "another photo using a.txt". The same with the
   permanent delete. Now a closed copy does not count when it is the same file as a photo already
   removed in the same operation (same whole name and same path; with no paths, the same open folder).
   Neighbouring cases that must not change: only one twin closed and reopened, none closed (a.txt
   leaves); the closed copy of a twin that was NOT removed still keeps a.txt on disk.
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-trash-closed-twins.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, cartellaFinta } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const B = String.fromCharCode(92);
const D = 'E:' + B + 'dataset' + B;
const foto = (id, nome, { cartella = D, dirHandle = null } = {}) => ({ id, file: { name: nome, percorso: cartella ? cartella + nome : '' },
    thumb: 'blob:x/' + id, tags: ['cat'], originalTags: ['cat'], isTrashed: false, dirHandle });
// ITALIANO: come handleCloseImage: la foto va fra le chiuse ed esce dalla galleria.
// ENGLISH: like handleCloseImage: the photo goes among the closed ones and leaves the gallery.
const chiudi = async (app, f) => {
    app.refs.fotoChiuseRef.current.set(f.id, { id: f.id, name: f.file.name, lotto: '', cartella: '', foto: f });
    app.modifica(prev => prev.filter(i => i.id !== f.id));
    await app.attendi();
};

/* ITALIANO: `chiudiQuali` = quali gemelle chiudere con la X (P = a.png, J = a.jpg); `riapri` = i nomi
   che rientrano riaprendo la cartella, in quell'ordine; `togli` = i nomi da cestinare e svuotare.
   `opzioni` = come fare le foto (cartella aperta, percorsi). Torna le foto toccate sul disco.
   ENGLISH: `chiudiQuali` = which twins to close with the X (P = a.png, J = a.jpg); `riapri` = the
   names that come back reopening the folder, in that order; `togli` = the names to trash and empty.
   `opzioni` = how to make the photos (open folder, paths). Returns the files touched on disk. */
const giro = async ({ chiudiQuali, riapri, togli = ['a.png', 'a.jpg'], conApi = true, opzioni = {} }) => {
    const api = conApi ? apiFinta() : null;
    const png = foto('P', 'a.png', opzioni), jpg = foto('J', 'a.jpg', opzioni);
    const app = creaApp([foto('Z', 'z.png', opzioni), png, jpg], { api });
    await app.attendi();
    for (const f of [png, jpg].filter(f => chiudiQuali.includes(f.id))) await chiudi(app, f);
    const nuove = riapri.map(n => foto(n === 'a.png' ? 'P2' : 'J2', n, opzioni));
    app.modifica(prev => [...prev, ...nuove.filter(f => !prev.some(p => p.file.name === f.file.name))]);
    await app.attendi();
    for (const f of app.stato.images.filter(i => togli.includes(i.file.name))) { app.cestina(f.id); await app.attendi(); }
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    if (!conApi) { await app.stato.confirmDialog.onConfirm(); await app.attendi(10); }
    const toccati = conApi ? api.chiamate.flat().map(p => p.slice(p.lastIndexOf(B) + 1)) : (opzioni.dirHandle ? opzioni.dirHandle.rimossi : []);
    return { toccati, galleria: app.vista() };
};
const conTxt = (r) => r.toccati.includes('a.txt');

console.log('\n--- Svuota Cestino (Cestino di Windows) ---');
{
    const r = await giro({ chiudiQuali: ['P', 'J'], riapri: ['a.jpg', 'a.png'] });
    dice('premessa: le due immagini vanno nel Cestino di Windows', true, r.toccati.includes('a.png') && r.toccati.includes('a.jpg'));
    dice('chiuse tutte e due, riaperte (a.jpg, a.png): a.txt va nel Cestino con loro', true, conTxt(r));
}
{
    const r = await giro({ chiudiQuali: ['P', 'J'], riapri: ['a.png', 'a.jpg'] });
    dice('chiuse tutte e due, riaperte (a.png, a.jpg): a.txt va nel Cestino con loro', true, conTxt(r));
}

console.log('\n--- cancellazione definitiva (anteprima senza percorsi: decide la cartella aperta) ---');
{
    const cartella = cartellaFinta();
    const r = await giro({ chiudiQuali: ['P', 'J'], riapri: ['a.jpg', 'a.png'], conApi: false, opzioni: { cartella: '', dirHandle: cartella } });
    dice('premessa: le due immagini cancellate per sempre', true, r.toccati.includes('a.png') && r.toccati.includes('a.jpg'));
    dice('chiuse tutte e due, riaperte: anche a.txt cancellato', true, conTxt(r));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = await giro({ chiudiQuali: ['J'], riapri: ['a.jpg'] });
    dice('chiusa solo a.jpg e riaperta: a.txt va nel Cestino', true, conTxt(r));
}
{
    const r = await giro({ chiudiQuali: [], riapri: [] });
    dice('nessuna chiusa: a.txt va nel Cestino', true, conTxt(r));
}
{
    // ITALIANO: a.jpg chiusa e MAI riaperta, si svuota solo a.png: Ctrl+Z puo' riportare a.jpg, a.txt resta.
    // ENGLISH: a.jpg closed and NEVER reopened, only a.png is emptied: Ctrl+Z can bring a.jpg back, a.txt stays.
    const r = await giro({ chiudiQuali: ['J'], riapri: [], togli: ['a.png'] });
    dice('premessa: a.png va nel Cestino', true, r.toccati.includes('a.png'));
    dice('a.jpg chiusa e non tolta: a.txt resta sul disco', false, conTxt(r));
}
{
    // ITALIANO: le due chiuse, riaperte, ma si svuota solo a.png: la copia chiusa di a.jpg e' lo
    //           stesso file di a.jpg, che resta in galleria e usa a.txt.
    // ENGLISH: both closed, reopened, but only a.png is emptied: the closed copy of a.jpg is the same
    //          file as a.jpg, which stays in the gallery and uses a.txt.
    const r = await giro({ chiudiQuali: ['P', 'J'], riapri: ['a.jpg', 'a.png'], togli: ['a.png'] });
    dice('solo a.png svuotata: a.txt resta per a.jpg', false, conTxt(r));
}
{
    // ITALIANO: a.jpg chiusa viene da un'altra cartella: non e' la a.jpg tolta, ma non usa nemmeno a.txt.
    // ENGLISH: the closed a.jpg comes from another folder: it is not the removed a.jpg, nor does it use a.txt.
    const ALTRA = 'F:' + B + 'altro' + B;
    const api = apiFinta();
    const app = creaApp([foto('P', 'a.png'), foto('J', 'a.jpg'), foto('JX', 'a.jpg', { cartella: ALTRA })], { api });
    await app.attendi();
    await chiudi(app, foto('JX', 'a.jpg', { cartella: ALTRA }));
    for (const id of ['P', 'J']) { app.cestina(id); await app.attendi(); }
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    dice('a.jpg chiusa di un\'altra cartella: a.txt va nel Cestino', true, api.chiamate.flat().some(p => p.endsWith(B + 'a.txt')));
}

process.exit(esito());
