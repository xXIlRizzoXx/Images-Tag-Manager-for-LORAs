/* ITALIANO: PROVA: "IMPORTA" MENTRE "ANNULLA LO SVUOTAMENTO" E' IN CORSO ASPETTA
   "Annulla lo svuotamento" ci mette qualche secondo: prima rimette le immagini, poi i .txt. Una
   cartella aperta o trascinata in quel momento faceva entrare le immagini gia' tornate come foto
   NUOVE senza tag (il loro .txt era ancora nel Cestino di Windows); alla fine l'annullamento
   rimetteva anche le foto vecchie: due card per lo stesso file, e un Salva della copia nuova
   scriveva nel .txt le sole trigger sopra la didascalia appena tornata. Ora "Importa" del riepilogo,
   da cui passano tutte le aperture (Carica Cartella, Carica immagini, trascinamento), durante
   l'annullamento non importa niente, lo dice e lascia il riepilogo aperto: finito l'annullamento si
   preme di nuovo e le foto gia' tornate contano come gia' aperte.
   Si esegue il testo VERO di confermaImport (import-harness.mjs).
   Uso:  node scripts/test-import-during-undo-empty.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: "IMPORT" WHILE "UNDO THE EMPTYING" IS RUNNING WAITS
   "Undo the emptying" takes a few seconds: first it puts the images back, then the .txt files. A
   folder opened or dropped at that moment brought the images already back in as NEW untagged photos
   (their .txt was still in the Windows Recycle Bin); at the end the undo put the old photos back too:
   two cards for the same file, and a Save of the new copy wrote just the triggers into the .txt over
   the caption just restored. Now the summary's "Import", which every opening goes through (Load
   Folder, Load images, drop), imports nothing during the undo, says so and leaves the summary open:
   once the undo is over it is pressed again and the photos already back count as already open.
   The REAL text of confermaImport (import-harness.mjs) runs.
   Usage:  node scripts/test-import-during-undo-empty.mjs      (exits with code 1 if anything is off) */

import { creaApp, cartella, riepilogo, t } from './import-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();

console.log('\n--- "Importa" durante "Annulla lo svuotamento" ---');
{
    const h = cartella('E:img', 'img');
    const app = creaApp();
    app.refs.ripristinoInCorsoRef.current = true;
    const d = riepilogo(h, ['a.png', 'b.png']);
    await app.conferma(d);
    dice('non entra nessuna foto', [], app.nomi());
    dice('l\'avviso dice che i file si stanno rimettendo a posto', [t.undoEmptyWorking, 'info'], app.ultimo());
    dice('il riepilogo resta aperto, per riprovare dopo', true, app.riepilogoAperto);
    app.refs.ripristinoInCorsoRef.current = false;
    await app.conferma(d);
    dice('finito l\'annullamento, lo stesso "Importa" importa', ['a.png', 'b.png'], app.nomi());
    dice('...e chiude il riepilogo', false, app.riepilogoAperto);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    // ITALIANO: dopo l'annullamento la foto e' di nuovo nel cestino dell'app con la sua cartella.
    // ENGLISH: after the undo the photo is back in the app's trash with its folder.
    const h = cartella('E:img', 'img');
    const tornata = { id: 'x', file: { name: 'a.png', percorso: 'E:\\img\\a.png', size: 10, lastModified: 1000 }, tags: ['red hair'], originalTags: ['red hair'],
        isTrashed: true, dirHandle: h, thumb: '' };
    const app = creaApp({ iniziali: [tornata] });
    await app.conferma(riepilogo(cartella('E:img', 'img'), ['a.png', 'c.png']));
    dice('la foto tornata nel cestino dell\'app non entra una seconda volta, la nuova si', ['a.png', 'c.png'], app.nomi());
    dice('...e la foto tornata tiene i suoi tag e la sua cartella', [['red hair'], true], [app.images[0].tags, app.images[0].dirHandle === h]);
    const vuota = creaApp();
    await vuota.conferma(riepilogo(cartella('E:z', 'z'), ['z.png']));
    dice('senza annullamento in corso "Importa" funziona come prima', ['z.png'], vuota.nomi());
}

process.exit(esito());
