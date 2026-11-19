/* ITALIANO: PROVA DEL dataset.zip VUOTO LASCIATO DA UN'ESPORTAZIONE FALLITA
   In Chromium (e quindi in Electron) la finestra «Salva» crea il file scelto, o lo svuota se c'e'
   gia', nel momento in cui l'utente conferma; le scritture vanno in un file di scambio che close()
   porta sul file e abort() butta. Quando l'esportazione falliva (una foto che non si legge, il disco
   pieno) restava un dataset.zip da 0 byte, mentre l'avviso diceva «l'archivio ZIP non e' stato
   creato», e un file vuoto con quel nome poteva finire caricato per l'addestramento. Ora, dopo
   abort(), il file scelto si toglie, ma solo se e' davvero vuoto: se non lo e' (il file di prima
   e' rimasto com'era) non si tocca.
   Si esegue il testo VERO dell'esportazione di src/App.tsx con il banco scripts/export-harness.mjs.
   Uso:  node scripts/test-export-failed-empty-zip.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE EMPTY dataset.zip LEFT BY A FAILED EXPORT
   In Chromium (and so in Electron) the "Save" dialog creates the chosen file, or empties it when it
   already exists, the moment the user confirms; writes go to a swap file that close() moves onto the
   file and abort() throws away. When the export failed (a photo that cannot be read, a full disk) a
   0-byte dataset.zip was left, while the notice said "the ZIP archive was not created", and an empty
   file with that name could end up uploaded for training. Now, after abort(), the chosen file is
   removed, but only when it really is empty: when it is not (the previous file stayed as it was) it
   is left alone.
   The REAL export code of src/App.tsx is run on the scripts/export-harness.mjs bench.
   Usage:  node scripts/test-export-failed-empty-zip.mjs      (exits with code 1 if anything is off) */

import { creaControlli } from './main-harness.mjs';
import { creaApp, creaSonda, FotoFinta, byteDi, t } from './export-harness.mjs';

const { dice, esito } = creaControlli();

// ITALIANO: tre foto caricate senza cartella; con `rotta` la seconda non si legge piu' (cancellata o
//           ritoccata dopo l'import).
// ENGLISH: three photos loaded without a folder; with `rotta` the second one no longer reads (deleted
//          or retouched after the import).
const progetto = (sonda, rotta) => ['p1.png', 'p2.png', 'p3.png'].map((nome, i) => ({
    id: nome, file: new FotoFinta(byteDi(300, i + 5), nome, sonda, rotta && nome === 'p2.png'),
    tags: ['t' + i], isTrashed: false, dirHandle: null,
}));
const ultima = (r) => r.notifiche[r.notifiche.length - 1];

console.log('\n--- una foto che non si legge ---');
{
    const sonda = creaSonda();
    const r = await creaApp(progetto(sonda, true), sonda).esporta(true);
    dice('premessa: l\'avviso nomina la foto', [t.zipPhotoUnreadable.replace('{name}', 'p2.png'), 'error'], ultima(r));
    dice('il file di scambio si butta (abort), niente close', [true, false], [r.annullato, r.chiuso]);
    dice('il dataset.zip rimasto vuoto si toglie', true, r.rimosso);
}

console.log('\n--- disco pieno alla prima scrittura ---');
{
    const sonda = creaSonda();
    const r = await creaApp(progetto(sonda, false), sonda, { discoPieno: true }).esporta(true);
    dice('premessa: l\'avviso generico dell\'archivio', [t.zipError, 'error'], ultima(r));
    dice('il dataset.zip rimasto vuoto si toglie', [true, true], [r.annullato, r.rimosso]);
}

// ITALIANO: l'archivio e' scritto tutto, ma close() fallisce (il file scelto tenuto aperto da un altro
//           programma o dall'antivirus): la pulizia stava solo intorno alle scritture.
// ENGLISH: the archive is written in full, but close() fails (the chosen file kept open by another
//          program or by the antivirus): the clean-up wrapped only the writes.
console.log('\n--- close() che fallisce ---');
{
    const sonda = creaSonda();
    const r = await creaApp(progetto(sonda, false), sonda, { chiusuraFallita: true }).esporta(true);
    dice('premessa: l\'avviso generico dell\'archivio', [t.zipError, 'error'], ultima(r));
    dice('il dataset.zip rimasto vuoto si toglie', true, r.rimosso);
}
{
    const sonda = creaSonda();
    const r = await creaApp(progetto(sonda, false), sonda, { chiusuraFallita: true, fileDiPrima: 12345 }).esporta(true);
    dice('close() fallisce ma il file scelto NON e\' vuoto: non si tocca', false, r.rimosso);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const sonda = creaSonda();
    const r = await creaApp(progetto(sonda, true), sonda, { fileDiPrima: 12345 }).esporta(true);
    dice('il file scelto NON e\' vuoto (l\'archivio di prima e\' rimasto): non si tocca', [true, false], [r.annullato, r.rimosso]);
}
{
    const sonda = creaSonda();
    const r = await creaApp(progetto(sonda, false), sonda).esporta(true);
    dice('esportazione riuscita: si chiude, niente abort e niente rimozione', [true, false, false], [r.chiuso, r.annullato, r.rimosso]);
    dice('esportazione riuscita: l\'avviso di sempre', [t.zipSuccess, 'success'], ultima(r));
    dice('esportazione riuscita: il file ha i byte dell\'archivio', true, r.sulDisco > 0);
}

process.exit(esito());
