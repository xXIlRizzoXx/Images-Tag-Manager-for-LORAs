/* ITALIANO: PROVA DI "Esporta (.zip)" MENTRE L'AI TAGGA
   "Tagga tutte con AI" (o un'AI via MCP) continua a lavorare mentre la finestra di scelta
   dell'esportazione e' aperta. La finestra teneva le foto com'erano al primo clic su "Esporta (.zip)":
   le foto taggate nel frattempo uscivano senza .txt ("Solo i tag" le saltava, "Tag e immagini" le
   metteva senza .txt con l'avviso "Foto senza tag... 2", falso), e si sarebbero addestrate senza
   descrizione. Ora "Esporta" nella finestra prende le foto come sono in quel momento.
   Casi vicini che non devono cambiare: una foto messa nel cestino resta fuori, una foto ancora senza
   tag entra senza .txt e l'avviso la conta, l'ordine resta quello di "Ordina per".
   Si eseguono i testi VERI di handleExportAll, avviaExport ed exportAllAsZip (export-harness.mjs).
   Uso:  node scripts/test-export-during-ai.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "Export (.zip)" WHILE THE AI TAGS
   "Tag all with AI" (or an AI through MCP) keeps working while the export choice dialog is open. The
   dialog kept the photos as they were at the first click on "Export (.zip)": the photos tagged in the
   meantime came out without a .txt ("Tags only" skipped them, "Tags and images" put them in without a
   .txt under the notice "Photos with no tags... 2", which was false), and would have trained without a
   caption. Now "Export" in the dialog takes the photos as they are at that moment.
   Neighbouring cases that must not change: a photo put in the trash stays out, a still-untagged photo
   goes in without a .txt and the notice counts it, the order stays the "Sort by" one.
   The REAL text of handleExportAll, avviaExport and exportAllAsZip runs (export-harness.mjs).
   Usage:  node scripts/test-export-during-ai.mjs      (exits with code 1 if anything is off) */

import { creaControlli } from './main-harness.mjs';
import { creaApp, creaSonda, FotoFinta, byteDi, t } from './export-harness.mjs';

const { dice, esito } = creaControlli();
const foto = (sonda, id, nome, tags, i) => ({ id, file: new FotoFinta(byteDi(30, i), nome, sonda), tags, originalTags: tags, isTrashed: false, dirHandle: null, cartellaRel: '' });
// ITALIANO: l'elenco vivo cambia come in React: oggetti nuovi nello stesso elenco del componente.
// ENGLISH: the live list changes as in React: new objects in the component's same list.
const cambia = (images, id, campi) => { const i = images.findIndex(f => f.id === id); images[i] = { ...images[i], ...campi }; };
const testo = (voci, nome) => (voci && voci[nome] ? voci[nome].toString('utf8') : undefined);

console.log('\n--- l\'AI tagga due foto mentre la finestra di scelta e\' aperta ---');
for (const conImmagini of [false, true]) {
    const sonda = creaSonda();
    const images = [foto(sonda, 'a', 'a.png', ['cat'], 1), foto(sonda, 'b', 'b.png', [], 2), foto(sonda, 'c', 'c.png', [], 3)];
    const app = creaApp(images, sonda);
    app.apri();
    cambia(images, 'b', { tags: ['1girl', 'smile'] });
    cambia(images, 'c', { tags: ['dog'] });
    await app.conferma(conImmagini);
    const voci = await app.archivio() || {};
    const strada = conImmagini ? '"Tag e immagini"' : '"Solo i tag"';
    dice(strada + ': b.txt e c.txt hanno i tag messi dall\'AI', ['1girl, smile,', 'dog,'], [testo(voci, 'b.txt'), testo(voci, 'c.txt')]);
    dice(strada + ': a.txt resta', 'cat,', testo(voci, 'a.txt'));
    if (conImmagini) {
        dice('...e l\'avviso non parla di foto senza tag', false, app.notifiche.some(([m]) => /without a \.txt/i.test(m)));
    }
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const sonda = creaSonda();
    const images = [foto(sonda, 'a', 'a.png', ['cat'], 1), foto(sonda, 'b', 'b.png', ['dog'], 2), foto(sonda, 'c', 'c.png', [], 3)];
    const app = creaApp(images, sonda);
    app.apri();
    cambia(images, 'b', { isTrashed: true });
    await app.conferma(true);
    const nomi = Object.keys(await app.archivio() || {}).sort();
    dice('una foto messa nel cestino con la finestra aperta resta fuori', ['a.png', 'a.txt', 'c.png'], nomi);
    dice('...e la foto senza tag entra senza .txt, contata nell\'avviso', true, app.notifiche.some(([m]) => m.includes(t.zipUntaggedOne)));
}
{
    const sonda = creaSonda();
    const images = [foto(sonda, 'b', 'b.png', ['x'], 2), foto(sonda, 'a', 'a.png', ['y'], 1)];
    const app = creaApp(images, sonda);
    app.apri();
    await app.conferma(false, true);
    const voci = await app.archivio() || {};
    dice('rinominando l\'ordine resta quello di "Ordina per" (A-Z)', ['y,', 'x,'], [testo(voci, '0001.txt'), testo(voci, '0002.txt')]);
}

process.exit(esito());
