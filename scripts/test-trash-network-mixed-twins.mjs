/* ITALIANO: PROVA: CARTELLA DI RETE, GEMELLE a.png/a.jpg APERTE IN DUE MODI: "ELIMINA PER SEMPRE" SU a.png
   LASCIA a.txt AD a.jpg
   Cartella di rete \\nas\ds con a.png, a.jpg e un solo a.txt. a.jpg trascinata sulla finestra: ha il
   percorso e nessuna cartella. Poi "Carica Cartella" della stessa cartella: a.jpg conta come gia'
   aperta (la coppia mista di alreadyOpen.ts), a.png entra con la cartella ma senza percorso (per la
   rete il percorso non arriva mai). a.png nel cestino, "Svuota Cestino", seconda conferma ("Elimina
   per sempre"): a.txt se ne andava PER SEMPRE insieme ad a.png, mentre a.jpg restava in galleria
   "salvata" (Salva non lo riscrive) e sulla rete non c'e' nessun Cestino da cui riprenderlo.
   txtUsatoDaAltre non riconosceva la coppia mista (un percorso da una parte, solo la cartella
   dall'altra). Ora, se la cartella aperta ha il nome della cartella del percorso, a.txt resta.
   Stessa causa per la copia chiusa con la X (aperta prima da sola, col percorso) e riaperta dalla
   cartella: restava fra le chiuse dopo la cancellazione, e Ctrl+Z la rimetteva in galleria senza file.
   Casi vicini che non devono cambiare: tutte e due col percorso (a.txt resta); cartella di nome
   diverso (a.txt se ne va con a.png); copia chiusa di un'altra cartella o di un altro file (resta
   fra le chiuse).
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-trash-network-mixed-twins.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: NETWORK FOLDER, TWINS a.png/a.jpg OPENED IN TWO WAYS: "DELETE FOR GOOD" ON a.png
   LEAVES a.txt TO a.jpg
   Network folder \\nas\ds with a.png, a.jpg and a single a.txt. a.jpg dropped on the window: it has
   the path and no folder. Then "Load Folder" of the same folder: a.jpg counts as already open (the
   mixed pair of alreadyOpen.ts), a.png comes in with the folder but no path (for the network the
   path never arrives). a.png to the trash, "Empty Trash", second confirmation ("Delete for good"):
   a.txt left FOR GOOD together with a.png, while a.jpg stayed in the gallery "saved" (Save does not
   write it again) and on the network there is no Recycle Bin to take it back from.
   txtUsatoDaAltre did not recognise the mixed pair (a path on one side, only the folder on the
   other). Now, when the open folder has the name of the path's folder, a.txt stays.
   Same cause for the copy closed with the X (opened first alone, with the path) and reopened from
   the folder: it stayed among the closed photos after the delete, and Ctrl+Z put it back with no file.
   Neighbouring cases that must not change: both with a path (a.txt stays); folder with a different
   name (a.txt leaves with a.png); closed copy from another folder or of another file (stays closed).
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-trash-network-mixed-twins.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, cartellaFinta } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const B = String.fromCharCode(92);
const rete = (cartella, nome) => B + B + 'nas' + B + cartella + B + nome;

// ITALIANO: a.png aperta con "Carica Cartella" di una cartella di rete: la cartella, nessun percorso.
// ENGLISH: a.png opened with "Load Folder" of a network folder: the folder, no path.
const conCartella = (id, nome, cartella, extra = {}) => ({ id, file: { name: nome, ...extra }, thumb: 'blob:x/' + id,
    tags: ['red'], originalTags: ['red'], isTrashed: true, dirHandle: cartella, filePath: '', width: 1, height: 1 });
// ITALIANO: una foto trascinata: il percorso, nessuna cartella.
// ENGLISH: a dropped photo: the path, no folder.
const conPercorso = (id, nome, percorso, extra = {}) => ({ id, file: { name: nome, percorso, ...extra }, thumb: 'blob:x/' + id,
    tags: ['red'], originalTags: ['red'], isTrashed: false, dirHandle: null, width: 1, height: 1 });

/* ITALIANO: svuota il cestino (con a.png dentro) e conferma la seconda finestra. `chiusa` = una foto
   chiusa con la X. Torna i nomi rimossi per sempre dalla cartella e se la chiusa e' ancora fra le chiuse.
   ENGLISH: empties the trash (with a.png in it) and confirms the second dialog. `chiusa` = a photo
   closed with the X. Returns the names removed for good from the folder and whether the closed one
   is still among the closed photos. */
const svuota = async (immagini, cartella, chiusa = null) => {
    const app = creaApp(immagini, { api: apiFinta({ esitoDi: () => 'rifiutato' }) });
    if (chiusa) app.refs.fotoChiuseRef.current.set(chiusa.id, { id: chiusa.id, name: chiusa.file.name, lotto: '', cartella: '', foto: chiusa });
    await app.attendi();
    await app.render().handleEmptyTrash();
    await app.attendi(10);
    const conferma = !!app.stato.confirmDialog.isOpen;
    if (conferma) { await app.stato.confirmDialog.onConfirm(); await app.attendi(10); }
    return { conferma, rimossi: [...cartella.rimossi], galleria: app.vista(), chiusaRimasta: chiusa ? app.refs.fotoChiuseRef.current.has(chiusa.id) : null };
};

console.log('\n--- coppia mista di rete: a.png con la cartella, a.jpg col solo percorso ---');
{
    const cartella = cartellaFinta(); cartella.name = 'ds';
    const r = await svuota([conCartella('png', 'a.png', cartella), conPercorso('jpg', 'a.jpg', rete('ds', 'a.jpg'))], cartella);
    dice('premessa: si apre la seconda conferma (Elimina per sempre)', true, r.conferma);
    dice('a.png se ne va, a.txt resta per a.jpg', JSON.stringify(['a.png']), JSON.stringify(r.rimossi));
    dice('a.jpg resta in galleria', JSON.stringify(['jpg']), JSON.stringify(r.galleria));
}
{
    const cartella = cartellaFinta(); cartella.name = 'DS';
    const r = await svuota([conCartella('png', 'a.png', cartella), conPercorso('jpg', 'a.jpg', rete('ds', 'a.jpg'))], cartella);
    dice('le maiuscole del nome della cartella non contano: a.txt resta', JSON.stringify(['a.png']), JSON.stringify(r.rimossi));
}
{
    const cartella = cartellaFinta(); cartella.name = 'ds';
    const jpg = conPercorso('jpg', 'a.jpg', rete('ds', 'a.jpg'));
    const r = await svuota([conCartella('png', 'a.png', cartella)], cartella, jpg);
    dice('a.jpg chiusa con la X (col percorso): a.txt resta anche per lei', JSON.stringify(['a.png']), JSON.stringify(r.rimossi));
}

console.log('\n--- casi vicini che non devono cambiare ---');
{
    const cartella = cartellaFinta(); cartella.name = 'ds';
    const png = conCartella('png', 'a.png', cartella); png.filePath = 'E:' + B + 'ds' + B + 'a.png';
    const r = await svuota([png, conPercorso('jpg', 'a.jpg', 'E:' + B + 'ds' + B + 'a.jpg')], cartella);
    dice('tutte e due col percorso, stessa cartella: a.txt resta', JSON.stringify(['a.png']), JSON.stringify(r.rimossi));
}
{
    const cartella = cartellaFinta(); cartella.name = 'ds';
    const r = await svuota([conCartella('png', 'a.png', cartella), conPercorso('jpg', 'a.jpg', rete('altra', 'a.jpg'))], cartella);
    dice('a.jpg di un\'altra cartella (\\\\nas\\altra): a.txt se ne va con a.png', JSON.stringify(['a.png', 'a.txt']), JSON.stringify(r.rimossi));
}
{
    const cartella = cartellaFinta(); cartella.name = 'ds';
    const r = await svuota([conCartella('png', 'a.png', cartella)], cartella);
    dice('a.png da sola: a.txt se ne va con lei', JSON.stringify(['a.png', 'a.txt']), JSON.stringify(r.rimossi));
}

console.log('\n--- copia chiusa con la X (col percorso) dello stesso file, riaperta dalla cartella ---');
const dati = { size: 1234, lastModified: 1700000000000 };
{
    const cartella = cartellaFinta(); cartella.name = 'ds';
    const r = await svuota([conCartella('nuova', 'a.png', cartella, dati)], cartella, conPercorso('vecchia', 'a.png', rete('ds', 'a.png'), dati));
    dice('premessa: a.png e a.txt rimossi per sempre', JSON.stringify(['a.png', 'a.txt']), JSON.stringify(r.rimossi));
    dice('la copia chiusa dello stesso file esce dalle chiuse', false, r.chiusaRimasta);
}
{
    const cartella = cartellaFinta(); cartella.name = 'ds';
    const r = await svuota([conCartella('nuova', 'a.png', cartella, dati)], cartella, conPercorso('vecchia', 'a.png', rete('altra', 'a.png'), dati));
    dice('copia chiusa di un\'altra cartella: resta fra le chiuse', true, r.chiusaRimasta);
}
{
    const cartella = cartellaFinta(); cartella.name = 'ds';
    const r = await svuota([conCartella('nuova', 'a.png', cartella, dati)], cartella, conPercorso('vecchia', 'a.png', rete('ds', 'a.png'), { size: 999, lastModified: dati.lastModified }));
    dice('copia chiusa con un\'altra dimensione (un altro file): resta fra le chiuse', true, r.chiusaRimasta);
}
{
    const cartella = cartellaFinta(); cartella.name = 'ds';
    const r = await svuota([conCartella('nuova', 'a.png', cartella, dati)], cartella, conPercorso('vecchia', 'a.png', rete('ds', 'a.png'), { size: dati.size, lastModified: 1 }));
    dice('copia chiusa con un\'altra data di modifica: resta fra le chiuse', true, r.chiusaRimasta);
}

// ITALIANO: tutte e due le gemelle con la cartella, piu' la copia chiusa di a.png col percorso (stesso
//           file). Prima la copia chiusa non era riconosciuta come "gia' tolta" (il blocco giaTolte
//           confrontava solo percorso con percorso o cartella con cartella) e a.txt restava orfano.
// ENGLISH: both twins with the folder, plus the closed copy of a.png with the path (same file). The
//          closed copy was not recognised as "already removed" (the giaTolte block only compared path
//          with path or folder with folder) and a.txt stayed orphaned.
console.log('\n--- tutte e due le gemelle con la cartella e una copia chiusa di a.png col percorso ---');
for (const ordine of [['png', 'jpg'], ['jpg', 'png']]) {
    const cartella = cartellaFinta(); cartella.name = 'ds';
    const foto = { png: conCartella('png', 'a.png', cartella, dati), jpg: conCartella('jpg', 'a.jpg', cartella, { size: 77, lastModified: 5 }) };
    const r = await svuota(ordine.map(k => foto[k]), cartella, conPercorso('vecchia', 'a.png', rete('ds', 'a.png'), dati));
    dice(`ordine ${ordine.join(', ')}: a.png, a.jpg e a.txt rimossi, nessun a.txt orfano`, JSON.stringify(['a.jpg', 'a.png', 'a.txt']), JSON.stringify([...r.rimossi].sort()));
    dice(`ordine ${ordine.join(', ')}: la copia chiusa esce dalle chiuse`, false, r.chiusaRimasta);
}
{
    const cartella = cartellaFinta(); cartella.name = 'ds';
    const r = await svuota([conCartella('png', 'a.png', cartella, dati), conCartella('jpg', 'a.jpg', cartella, { size: 77, lastModified: 5 })], cartella,
        conPercorso('vecchia', 'a.png', rete('ds', 'a.png'), { size: 999, lastModified: 1 }));
    dice('copia chiusa di un ALTRO file (dimensione e data diverse): a.txt resta, nel dubbio vince la didascalia', true, !r.rimossi.includes('a.txt'));
}

process.exit(esito());
