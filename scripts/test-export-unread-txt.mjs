/* ITALIANO: PROVA DELL'ESPORTAZIONE DI UNA FOTO IL CUI .TXT NON SI E' POTUTO LEGGERE ALL'IMPORT
   Un .txt che c'e' ma non si legge (bloccato, oltre 1 MB, un file di OneDrive solo in rete con il
   PC offline) viene saltato dall'import: la foto ha in memoria solo le trigger di allora, non i
   suoi tag veri. "Salva Modifiche" non ci scrive sopra; l'esportazione invece la metteva
   nell'archivio con la sola trigger come didascalia ("Solo i tag": b.txt = "ohwx," che, estratto
   nella cartella del dataset, sostituiva il .txt vero), o senza .txt dicendo che "non ha tag", con
   l'avviso verde "Archivio ZIP scaricato con successo!". Ora resta fuori dall'archivio, immagine e
   .txt, e l'avviso finale la nomina e dice cosa fare.
   Si eseguono i testi VERI di handleExportAll, avviaExport ed exportAllAsZip presi da src/App.tsx
   (banco export-harness.mjs), con i testi veri e la regola vera di src/utils/sidecarTags.ts.
   Uso:  node scripts/test-export-unread-txt.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE EXPORT OF A PHOTO WHOSE .TXT COULD NOT BE READ AT IMPORT
   A .txt that exists but cannot be read (locked, over 1 MB, a OneDrive online-only file with the PC
   offline) is skipped by the import: in memory the photo has only that time's triggers, not its
   real tags. "Save Changes" does not write over it; the export instead put it in the archive with
   the trigger alone as its caption ("Tags only": b.txt = "ohwx," which, extracted into the dataset
   folder, replaced the real .txt), or with no .txt saying it "has no tags", under the green notice
   "ZIP archive downloaded successfully!". Now it stays out of the archive, image and .txt, and the
   final notice names it and says what to do.
   The REAL text of handleExportAll, avviaExport and exportAllAsZip taken from src/App.tsx is run
   (bench export-harness.mjs), with the real strings and the real rule of src/utils/sidecarTags.ts.
   Usage:  node scripts/test-export-unread-txt.mjs      (exits with code 1 if anything is off) */

import { creaApp, creaSonda, FotoFinta, byteDi, t } from './export-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();

// ITALIANO: a.png col .txt letto; b.png col .txt non letto, come la segna l'import (tagDiImport con
//           il .txt non letto: tag = originalTags = le trigger, e baseTxtNonLetto e' lo STESSO array).
// ENGLISH: a.png with the .txt read; b.png with the unread .txt, as the import marks it (tagDiImport
//          with the unread .txt: tags = originalTags = the triggers, and baseTxtNonLetto is the SAME array).
const progetto = (sonda, trigger, { bModificata = false } = {}) => {
    const a = { id: 'a', file: new FotoFinta(byteDi(10, 1), 'a.png', sonda), tags: [...trigger, '1girl', 'smile'], originalTags: ['1girl', 'smile'], isTrashed: false, cartellaRel: '' };
    const disco = [...trigger];
    const b = { id: 'b', file: new FotoFinta(byteDi(10, 2), 'b.png', sonda), tags: [...trigger], originalTags: disco, baseTxtNonLetto: disco, isTrashed: false, cartellaRel: '' };
    // ITALIANO: il visualizzatore ha scritto il suo .txt: originalTags e' un array nuovo, il .txt e' noto.
    // ENGLISH: the viewer wrote its .txt: originalTags is a new array, the .txt is known.
    if (bModificata) { b.tags = [...trigger, 'cat']; b.originalTags = [...b.tags]; }
    return [a, b];
};
const esporta = async (trigger, conImmagini, opzioni) => {
    const sonda = creaSonda();
    const app = creaApp(progetto(sonda, trigger, opzioni), sonda);
    await app.esporta(conImmagini, false);
    const archivio = await app.archivio();
    return { nomi: archivio ? Object.keys(archivio).sort() : [], testo: (n) => (archivio && archivio[n] ? archivio[n].toString() : null), ultima: app.notifiche[app.notifiche.length - 1] || ['', ''] };
};
const fraseB = t.exportUnreadTxtOne ? t.exportUnreadTxtOne.replace('{names}', 'b.png') : '(chiave exportUnreadTxtOne assente)';

for (const [etichetta, trigger] of [['trigger ohwx attiva', ['ohwx']], ['nessuna trigger', []]]) {
    console.log(`\n--- ${etichetta}, "Solo i tag" ---`);
    const r1 = await esporta(trigger, false);
    dice('nell\'archivio solo a.txt: nessun b.txt con la sola trigger', ['a.txt'], r1.nomi);
    dice('l\'avviso nomina b.png e dice perche\' e\' rimasta fuori', true, r1.ultima[0].includes(fraseB));
    dice('...e non e\' un avviso verde di successo', 'info', r1.ultima[1]);

    console.log(`\n--- ${etichetta}, "Tag e immagini" ---`);
    const r2 = await esporta(trigger, true);
    dice('nell\'archivio solo a.png e a.txt: b.png resta fuori, immagine e .txt', ['a.png', 'a.txt'], r2.nomi);
    dice('nessuna frase "foto senza tag": b.png i tag li ha, solo non si sono letti', false, r2.ultima[0].includes(t.zipUntaggedOne));
    dice('l\'avviso nomina b.png', true, r2.ultima[0].includes(fraseB));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = await esporta(['ohwx'], false, { bModificata: true });
    dice('b.png col .txt scritto dal visualizzatore (ora noto) si esporta come sempre', [['a.txt', 'b.txt'], 'ohwx, cat,'], [r.nomi, r.testo('b.txt')]);
    dice('...con l\'avviso verde di sempre', [t.zipSuccess, 'success'], r.ultima);
}
{
    // ITALIANO: tutte le foto col .txt non letto: niente archivio, e l'avviso dice perche'.
    // ENGLISH: every photo with an unread .txt: no archive, and the notice says why.
    const sonda = creaSonda();
    const [, b] = progetto(sonda, ['ohwx']);
    const app = creaApp([b], sonda);
    app.apri();
    dice('solo foto col .txt non letto: nessuna finestra di scelta, l\'avviso le nomina', [null, true, 'info'],
        [app.scelta, (app.notifiche[app.notifiche.length - 1] || [''])[0].includes(fraseB), (app.notifiche[app.notifiche.length - 1] || ['', ''])[1]]);
}

process.exit(esito());
