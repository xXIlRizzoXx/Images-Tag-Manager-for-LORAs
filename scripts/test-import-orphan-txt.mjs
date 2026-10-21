/* ITALIANO: PROVA DEI .txt SENZA FOTO NELLA CARTELLA APERTA (note, sample_prompts.txt, didascalie)
   Un .txt che non e' di nessuna foto si leggeva e si contava lo stesso: uno con piu' di 2000 voci
   faceva uscire in rosso "File di tag accorciati... Controlla i tag prima di salvare" al posto di
   "Immagini caricate", e uno scritto in ANSI diceva "File non letti: note.txt", anche se nessuna foto
   aveva perso niente. Ora un .txt senza foto non si legge e non entra nell'avviso.
   Casi vicini che non devono cambiare: il .txt lungo o illeggibile di una foto VERA si segnala ancora,
   con il suo nome, e le foto hanno i loro tag.
   Si eseguono i testi VERI di confermaImport e processImportData (scripts/import-harness.mjs).
   Uso:  node scripts/test-import-orphan-txt.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF .txt FILES WITH NO PHOTO IN THE OPENED FOLDER (notes, sample_prompts.txt, captions)
   A .txt belonging to no photo was read and counted all the same: one with more than 2000 entries
   brought up in red "Tag files shortened... Check the tags before saving" instead of "Images loaded",
   and one written in ANSI said "Files not read: note.txt", although no photo had lost anything. Now a
   .txt with no photo is not read and stays out of the notice.
   Neighbouring cases that must not change: a REAL photo's long or unreadable .txt is still reported,
   with its name, and the photos have their tags.
   The REAL text of confermaImport and processImportData runs (scripts/import-harness.mjs).
   Usage:  node scripts/test-import-orphan-txt.mjs      (exits with code 1 if anything is off) */

import { creaControlli } from './main-harness.mjs';
import { creaApp, cartella, riepilogo, t } from './import-harness.mjs';

const { dice, esito } = creaControlli();
const txt = (name, contenuto) => ({ name, size: Buffer.byteLength(contenuto), lastModified: 1, text: async () => contenuto, arrayBuffer: async () => new TextEncoder().encode(contenuto).buffer });
const txtByte = (name, byte) => ({ name, size: byte.length, lastModified: 1, text: async () => '', arrayBuffer: async () => Uint8Array.from(byte).buffer });
const lungo = Array.from({ length: 2500 }, (_, i) => 'prompt line ' + i).join(', ');
const ansi = [...Buffer.from('caff'), 0xe8, ...Buffer.from(' da comprare')];

// ITALIANO: apre `dataset` con a.png, b.png, i loro .txt e gli `altri` .txt.
// ENGLISH: opens `dataset` with a.png, b.png, their .txt files and the `altri` .txt files.
const apri = async (altri, propri = { a: 'ohwx, smile', b: 'ohwx, hat' }) => {
    const app = creaApp();
    const h = cartella('D1', 'dataset');
    const d = riepilogo(h, ['a.png', 'b.png']);
    d.txtFiles = [...Object.entries(propri).map(([n, c]) => (typeof c === 'string' ? txt(n + '.txt', c) : txtByte(n + '.txt', c))), ...altri];
    for (const f of d.txtFiles) d.folderOf.set(f, h);
    await app.conferma(d);
    return app;
};
const tagDi = (app, nome) => app.images.find(i => i.file.name === nome)?.tags;
const caricate = [t.successImport.replace('{n}', '2'), 'success'];

console.log('\n--- .txt senza foto nella cartella ---');
{
    const app = await apri([txt('sample_prompts.txt', lungo)]);
    dice('sample_prompts.txt di 2500 voci: "Immagini caricate: 2", non l\'errore "accorciati"', caricate, app.ultimo());
    dice('...e le foto hanno i loro tag', [['ohwx', 'smile'], ['ohwx', 'hat']], [tagDi(app, 'a.png'), tagDi(app, 'b.png')]);
}
{
    const app = await apri([txtByte('note.txt', ansi)]);
    dice('note.txt in ANSI: "Immagini caricate: 2", senza "File non letti: note.txt"', caricate, app.ultimo());
}
{
    const app = await apri([txt('enorme.txt', 'x'.repeat(1024 * 1024 + 10))]);
    dice('un .txt senza foto oltre 1 MB: "Immagini caricate: 2"', caricate, app.ultimo());
}
{
    const app = await apri([]);
    dice('senza .txt in piu\': "Immagini caricate: 2" come prima', caricate, app.ultimo());
}

console.log('\n--- quello che NON deve cambiare: il .txt di una foto vera ---');
{
    const app = await apri([txt('sample_prompts.txt', lungo)], { a: lungo, b: 'ohwx, hat' });
    dice('a.txt di 2500 voci: l\'errore "accorciati" resta', [t.importTxtShortened.replace('{n}', '1'), 'error'], app.ultimo());
    dice('...e a.png ha i tag accorciati (2000)', 2000, (tagDi(app, 'a.png') || []).length);
}
{
    const app = await apri([txtByte('note.txt', ansi)], { a: ansi, b: 'ohwx, hat' });
    const [testo, tipo] = app.ultimo() || [];
    dice('a.txt in ANSI: si segnala ancora con il suo nome, e note.txt no', [true, false, 'info'],
        [String(testo).includes('a.txt'), String(testo).includes('note.txt'), tipo]);
}

process.exit(esito());
