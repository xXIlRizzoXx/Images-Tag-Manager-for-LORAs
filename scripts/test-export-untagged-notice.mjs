/* ITALIANO: PROVA DI COSA SI DICE SULLE FOTO SENZA TAG IN "Esporta (.zip)" -> "Tag e immagini"
   "Tag e immagini" mette tutte le foto attive, e una foto senza tag entra SENZA .txt (un .txt
   vuoto fa fermare Kohya). Ma i testi dicevano il contrario: il suggerimento del pulsante ("ognuna
   accanto al suo .txt") e la nota di "Rinomina in sequenza" ("Ogni foto tiene accanto il suo .txt
   con lo stesso numero"), in tutte e nove le lingue; e alla fine l'avviso diceva solo "archivio
   scaricato". Con 10 foto, 3 senza tag, l'archivio aveva 10 foto e 7 .txt, e nessuno lo diceva:
   quelle 3 foto si sarebbero addestrate senza descrizione.
   La regola: i due testi dicono che una foto senza tag entra senza .txt, e dopo l'esportazione
   l'avviso dice quante foto sono entrate senza .txt, con una frase intera giusta anche per 1.
   Si leggono i testi VERI di src/constants.ts e si eseguono i testi VERI di handleExportAll,
   avviaExport ed exportAllAsZip (src/App.tsx) col banco di prova export-harness.mjs.
   Uso:  node scripts/test-export-untagged-notice.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF WHAT IS SAID ABOUT UNTAGGED PHOTOS IN "Export (.zip)" -> "Tags and images"
   "Tags and images" packs every active photo, and an untagged photo goes in WITHOUT a .txt (an
   empty .txt stops Kohya). But the texts said the opposite: the button tooltip ("each next to its
   own .txt") and the "Rename in sequence" hint ("Each photo keeps its own .txt beside it under the
   same number"), in all nine languages; and at the end the notice only said "archive downloaded".
   With 10 photos, 3 untagged, the archive held 10 photos and 7 .txt, and nobody said so: those 3
   photos would train without a caption.
   The rule: both texts say that an untagged photo goes in without a .txt, and after the export
   the notice says how many photos went in without a .txt, in a whole sentence that is right for 1
   too. The REAL strings of src/constants.ts are read and the REAL text of handleExportAll,
   avviaExport and exportAllAsZip (src/App.tsx) runs on the export-harness.mjs bench.
   Usage:  node scripts/test-export-untagged-notice.mjs      (exits with code 1 if anything is off) */

import { creaControlli } from './main-harness.mjs';
import { creaApp, creaSonda, FotoFinta, byteDi, t, lingue } from './export-harness.mjs';

const { dice, esito } = creaControlli();

// ITALIANO: in ogni lingua, le parole con cui i due testi dicono "foto senza tag".
// ENGLISH: in every language, the words the two texts use for "photo without tags".
const SENZA_TAG = { it: 'senza tag', en: 'no tags', fr: 'sans tags', es: 'sin etiquetas', de: 'ohne Tags', zh: '没有标签', ja: 'タグのない', pt: 'sem tags', ru: 'без тегов' };

console.log('\n--- i testi del pulsante e di "Rinomina in sequenza" ---');
for (const [codice, parole] of Object.entries(SENZA_TAG)) {
    const l = lingue[codice] || {};
    dice(`[${codice}] il suggerimento del pulsante dice che una foto senza tag entra senza .txt`, true, String(l.exportAllTip || '').includes(parole));
    dice(`[${codice}] la nota di "Rinomina in sequenza" lo dice anche lei`, true, String(l.exportRenameHint || '').includes(parole));
    dice(`[${codice}] la frase per 1 foto c'e' e non ha numeri da sostituire`, true, !!l.zipUntaggedOne && !/\{n\}/.test(l.zipUntaggedOne));
    dice(`[${codice}] la frase per piu' foto ha {n}`, true, /\{n\}/.test(String(l.zipUntaggedMany || '')));
}

// ITALIANO: 10 foto, quelle dei numeri in `senza` non hanno tag.
// ENGLISH: 10 photos, the ones whose numbers are in `senza` have no tags.
const progetto = (sonda, senza) => Array.from({ length: 10 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    const nome = `p${n}.png`;
    return { id: nome, file: new FotoFinta(byteDi(60, i), nome, sonda), tags: senza.includes(n) ? [] : ['tag' + n], isTrashed: false };
});
const molte = (n) => String(t.zipUntaggedMany || '').replace('{n}', String(n));

console.log('\n--- l\'avviso dopo l\'esportazione ---');
{
    const sonda = creaSonda();
    const r = await creaApp(progetto(sonda, ['02', '05', '09']), sonda).esporta(true);
    dice('"Tag e immagini", 3 foto senza tag: l\'avviso lo dice con la frase al plurale', [`${t.zipSuccess} ${molte(3)}`, 'info'], r.notifiche.at(-1));
}
{
    const sonda = creaSonda();
    const r = await creaApp(progetto(sonda, ['04']), sonda).esporta(true, true);
    dice('"Tag e immagini" rinominando, 1 foto senza tag: la frase al singolare', [`${t.zipSuccess} ${t.zipUntaggedOne}`, 'info'], r.notifiche.at(-1));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const sonda = creaSonda();
    const r = await creaApp(progetto(sonda, []), sonda).esporta(true);
    dice('tutte con tag: l\'avviso di sempre', [t.zipSuccess, 'success'], r.notifiche.at(-1));
}
{
    const sonda = creaSonda();
    const r = await creaApp(progetto(sonda, ['02', '05']), sonda).esporta(false);
    dice('"Solo i tag": le foto senza tag non entrano proprio, l\'avviso di sempre', [t.zipSuccess, 'success'], r.notifiche.at(-1));
}
{
    // ITALIANO: due foto con lo stesso nome in sottocartelle diverse, una senza tag: tutti e due gli
    //           avvisi, ognuno intero.
    // ENGLISH: two photos with the same name in different subfolders, one untagged: both notices,
    //          each whole.
    const sonda = creaSonda();
    const doppie = [
        { id: 'a', file: new FotoFinta(byteDi(40, 1), 'img.png', sonda), tags: ['x'], isTrashed: false, dirHandle: { name: 'uno' } },
        { id: 'b', file: new FotoFinta(byteDi(40, 2), 'img.png', sonda), tags: [], isTrashed: false, dirHandle: { name: 'due' } },
    ];
    const r = await creaApp(doppie, sonda).esporta(true);
    dice('nomi doppi e una foto senza tag: tutti e due gli avvisi', [`${t.zipSuccess} ${t.zipUntaggedOne} — ${t.zipNameCollisionWarn.replace('{n}', '1')}`, 'info'], r.notifiche.at(-1));
}

process.exit(esito());
