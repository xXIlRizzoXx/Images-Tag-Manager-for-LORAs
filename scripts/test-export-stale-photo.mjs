/* ITALIANO: PROVA DI "Esporta (.zip)" CON UNA FOTO CAMBIATA SUL DISCO DOPO L'IMPORT
   Si apre una cartella, si ritocca una foto in un altro programma, si torna e si esporta "Tag e
   immagini" senza riaprire la cartella. Chromium rifiuta di leggere un file cambiato sul disco
   dopo che lo si era aperto (NotReadableError): l'esportazione si fermava con un generico "Errore
   durante la creazione dello ZIP.", senza dire quale foto, e si perdeva tutto l'archivio.
   Ora la foto si rilegge dalla sua cartella quando tocca a lei (nell'archivio va la versione
   ritoccata); se non si legge lo stesso (spostata, cancellata, o caricata senza cartella) l'avviso
   dice QUALE foto, in una frase intera tradotta nelle nove lingue.
   Si esegue il testo VERO di exportAllAsZip (src/App.tsx) col banco di prova export-harness.mjs.
   Uso:  node scripts/test-export-stale-photo.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "Export (.zip)" WITH A PHOTO CHANGED ON DISK AFTER THE IMPORT
   Open a folder, retouch a photo in another program, come back and export "Tags and images"
   without reopening the folder. Chromium refuses to read a file changed on disk after it was opened
   (NotReadableError): the export stopped with a generic "Error creating ZIP.", naming no photo, and
   the whole archive was lost.
   Now the photo is re-read from its folder when its turn comes (the retouched version goes into the
   archive); if it still cannot be read (moved, deleted, or loaded without a folder) the notice says
   WHICH photo, in a whole sentence translated into the nine languages.
   The REAL text of exportAllAsZip (src/App.tsx) runs on the export-harness.mjs bench.
   Usage:  node scripts/test-export-stale-photo.mjs      (exits with code 1 if anything is off) */

import { creaControlli } from './main-harness.mjs';
import { creaApp, creaSonda, FotoFinta, byteDi, cartellaFinta, t, lingue } from './export-harness.mjs';

const { dice, esito } = creaControlli();
const PRIMA = byteDi(400, 1);
const DOPO = byteDi(500, 2);

// ITALIANO: tre foto; p2.png e' stata ritoccata DOPO l'import: la copia in memoria non si legge piu'.
//           `sulDisco` = come sono le foto ADESSO nella cartella (null = foto caricata senza cartella).
// ENGLISH: three photos; p2.png was retouched AFTER the import: the in-memory copy no longer reads.
//          `sulDisco` = the photos as they are NOW in the folder (null = photo loaded with no folder).
const progetto = (sonda, sulDisco) => {
    const dir = sulDisco ? cartellaFinta(sulDisco) : null;
    return ['p1.png', 'p2.png', 'p3.png'].map((nome, i) => ({
        id: nome, file: new FotoFinta(nome === 'p2.png' ? PRIMA : byteDi(300, i + 5), nome, sonda, nome === 'p2.png'),
        tags: ['t' + i], isTrashed: false, dirHandle: dir,
    }));
};
const attuali = (sonda, conP2 = true) => {
    const m = new Map([['p1.png', new FotoFinta(byteDi(300, 5), 'p1.png', sonda)], ['p3.png', new FotoFinta(byteDi(300, 7), 'p3.png', sonda)]]);
    if (conP2) m.set('p2.png', new FotoFinta(DOPO, 'p2.png', sonda));
    return m;
};
const avvisoFoto = (nome) => [t.zipPhotoUnreadable ? t.zipPhotoUnreadable.replace('{name}', nome) : '(zipPhotoUnreadable manca)', 'error'];

console.log('\n--- cartella aperta, p2.png ritoccata in un altro programma ---');
{
    const sonda = creaSonda();
    const r = await creaApp(progetto(sonda, attuali(sonda)), sonda).esporta(true);
    const voci = await r.archivio();
    dice('l\'archivio si crea e si dice "fatto"', [true, [t.zipSuccess, 'success']], [r.chiuso, r.notifiche[r.notifiche.length - 1]]);
    dice('dentro c\'e\' la versione ritoccata di p2.png', true, !!voci && !!voci['p2.png'] && voci['p2.png'].equals(Buffer.from(DOPO)));
    const r2 = await creaApp(progetto(sonda, attuali(sonda)), sonda).esporta(true, true);
    const voci2 = await r2.archivio();
    dice('anche rinominando in sequenza (0002.png)', true, !!voci2 && !!voci2['0002.png'] && voci2['0002.png'].equals(Buffer.from(DOPO)));
}

console.log('\n--- la foto non si legge in nessun modo: l\'avviso dice quale ---');
{
    const sonda = creaSonda();
    const r = await creaApp(progetto(sonda, null), sonda).esporta(true);
    dice('caricata con "Carica immagini" (senza cartella): si nomina p2.png', avvisoFoto('p2.png'), r.notifiche[r.notifiche.length - 1]);
    dice('il file di destinazione si butta via (non resta uno .zip a meta\')', [false, true], [r.chiuso, r.annullato]);
    const r2 = await creaApp(progetto(sonda, attuali(sonda, false)), sonda).esporta(true);
    dice('cancellata dalla cartella dopo l\'import: si nomina p2.png', avvisoFoto('p2.png'), r2.notifiche[r2.notifiche.length - 1]);
}

console.log('\n--- la frase nuova nelle nove lingue ---');
dice('zipPhotoUnreadable c\'e\' in tutte, con {name} una volta sola', [],
    ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'].filter(l => typeof lingue[l].zipPhotoUnreadable !== 'string' || lingue[l].zipPhotoUnreadable.split('{name}').length !== 2));

console.log('\n--- quello che NON deve cambiare ---');
{
    const sonda = creaSonda();
    const r = await creaApp(progetto(sonda, null), sonda).esporta(false);
    dice('"Solo i tag" non legge le foto: riesce anche con p2.png cambiata', [true, [t.zipSuccess, 'success'], 0], [r.chiuso, r.notifiche[r.notifiche.length - 1], sonda.letti]);
}

process.exit(esito());
