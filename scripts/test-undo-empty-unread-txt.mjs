/* ITALIANO: PROVA DI "ANNULLA LO SVUOTAMENTO" PER UNA FOTO IL CUI .TXT NON SI ERA LETTO ALL'IMPORT
   Una foto con un .txt che all'apertura della cartella non si e' potuto leggere (oltre 1 MB,
   bloccato, OneDrive solo in rete) ha nel programma solo le trigger, e "Salva Modifiche" non la
   tocca (txtNonLettoInVigore). Svuotata nel Cestino di Windows (immagine e .txt) e poi ripresa con
   "Annulla lo svuotamento", se l'immagine tornava e il .txt no la foto rientrava con originalTags
   [] (un array nuovo): perdeva la protezione, diventava "da salvare" con le sole trigger, e
   l'avviso diceva "I tag sono ancora nel programma ... Salva Modifiche per riscriverli". Falso: il
   programma quel .txt non l'ha mai letto, e Salva avrebbe scritto la sola trigger al posto della
   didascalia vera, rimasta nel Cestino di Windows. La regola: quella foto resta protetta e l'avviso
   dice, con una frase sua, che il file va ripreso a mano dal Cestino di Windows. Le foto il cui .txt
   era stato letto restano come prima.
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-undo-empty-unread-txt.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "UNDO THE EMPTYING" FOR A PHOTO WHOSE .TXT WAS NOT READ AT IMPORT
   A photo with a .txt that could not be read when the folder was opened (over 1 MB, locked, a
   OneDrive online-only file) holds only the triggers in the app, and "Save Changes" leaves it alone
   (txtNonLettoInVigore). Emptied to the Windows Recycle Bin (image and .txt) and then taken back
   with "Undo the emptying", if the image came back and the .txt did not, the photo re-entered with
   originalTags [] (a new array): it lost the protection, became "to be saved" with the triggers
   alone, and the notice said "The tags are still in the program ... Save Changes to write them
   again". False: the app never read that .txt, and Save would have written the trigger alone in
   place of the real caption, left in the Windows Recycle Bin. The rule: that photo stays protected
   and the notice says, with a sentence of its own, that the file must be taken back by hand from
   the Windows Recycle Bin. Photos whose .txt had been read stay as before.
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-undo-empty-unread-txt.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaApp, apiFinta, foto, lingue, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const uscita = await esbuild.build({ entryPoints: [path.join(radice, 'src/utils/sidecarTags.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const S = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));

const NON_LETTO = t.undoEmptyTxtNotBackUnread || '(testo undoEmptyTxtNotBackUnread mancante)';
const nonLetta = (id) => {
    const base = ['ohwx'];
    return { ...foto(id), tags: ['ohwx'], originalTags: base, baseTxtNonLetto: base };
};
const fotoCon = (app, id) => app.stato.images.find(i => i.id === id);
const messaggi = (app, da) => app.notifiche.slice(da).map(([m]) => m).join(' | ');
// ITALIANO: il Cestino di Windows rimette le immagini; i .txt rispondono `esitoTxt`.
// ENGLISH: the Windows Recycle Bin puts the images back; the .txt files answer `esitoTxt`.
const apiCon = (esitoTxt) => apiFinta({
    ripristino: (percorsi) => ({ results: percorsi.map(p => ({ percorso: p, esito: p.endsWith('.txt') ? esitoTxt : 'ok' })) }),
});
const svuotaEAnnulla = async (app) => {
    await app.render().handleEmptyTrash();
    await app.attendi();
    const da = app.notifiche.length;
    await app.render().annullaSvuotamento();
    await app.attendi();
    return da;
};

for (const esitoTxt of ['occupato', 'fallito', 'nonTrovato']) {
    console.log(`\n--- .txt non letto all'import, l'immagine torna e il .txt no ("${esitoTxt}") ---`);
    const app = creaApp([nonLetta('A')], { api: apiCon(esitoTxt) });
    dice('premessa: prima dello svuotamento la foto e\' protetta e non da salvare', [true, false],
        [S.txtNonLettoInVigore(app.stato.images[0]), S.fotoDaSalvare(app.stato.images[0], ['ohwx'])]);
    const da = await svuotaEAnnulla(app);
    const a = fotoCon(app, 'A');
    dice('la foto torna nel cestino dell\'app', true, !!a && a.isTrashed === true);
    dice('resta protetta: Salva non scrive la sola trigger al posto del .txt mai letto', true, !!a && S.txtNonLettoInVigore(a));
    dice('...e non risulta da salvare', false, !!a && S.fotoDaSalvare(a, ['ohwx']));
    const m = messaggi(app, da);
    dice('l\'avviso NON promette che i tag sono nel programma e che Salva li riscrive', false, m.includes(t.undoEmptyTxtNotBackOne));
    dice('l\'avviso dice di riprendere a mano dal Cestino di Windows il file mai letto', true, m.includes(t.undoEmptyTxtNotBackUnreadOne));
}

console.log('\n--- .txt condiviso non letto (a.png e a.jpg), andato via con la X su a.jpg ---');
{
    const base = ['ohwx'];
    const png = { id: 'PNG', file: { name: 'a.png', percorso: 'E:\\dataset\\a.png' }, thumb: 'blob:finto/PNG', tags: ['ohwx'], originalTags: base, baseTxtNonLetto: base, isTrashed: true, dirHandle: null };
    const jpg = { id: 'JPG', file: { name: 'a.jpg', percorso: 'E:\\dataset\\a.jpg' }, thumb: 'blob:finto/JPG', tags: ['ohwx'], originalTags: base, baseTxtNonLetto: base, isTrashed: false, dirHandle: null };
    let txtCe = true;
    const api = apiFinta({ txtSulDisco: () => txtCe });
    const app = creaApp([png, jpg], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    app.cestina('JPG');
    await app.attendi();
    await app.render().handleDeletePermanently('JPG');
    await app.attendi();
    txtCe = false;
    const da = app.notifiche.length;
    await app.render().annullaSvuotamento();
    await app.attendi();
    const a = fotoCon(app, 'PNG');
    dice('a.png torna e resta protetta', [true, true], [!!a && a.isTrashed === true, !!a && S.txtNonLettoInVigore(a)]);
    const m = messaggi(app, da);
    dice('l\'avviso non promette di riscrivere un .txt mai letto', false, m.includes(t.undoEmptyTxtNotBackOne));
    dice('...e dice di riprenderlo a mano', true, m.includes(t.undoEmptyTxtNotBackUnreadOne));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    // ITALIANO: una foto il cui .txt era stato letto: torna da salvare e l'avviso di prima.
    // ENGLISH: a photo whose .txt had been read: it comes back to be saved with the previous notice.
    const app = creaApp([foto('B')], { api: apiCon('fallito') });
    const da = await svuotaEAnnulla(app);
    const b = fotoCon(app, 'B');
    dice('.txt letto e non tornato: originalTags vuoto, da salvare', [[], true], [b?.originalTags, !!b && S.fotoDaSalvare(b, [])]);
    dice('...con l\'avviso "i tag sono ancora nel programma"', true, messaggi(app, da).includes(t.undoEmptyTxtNotBackOne));
    dice('...e senza la frase del .txt mai letto', false, messaggi(app, da).includes(t.undoEmptyTxtNotBackUnreadOne));
}
{
    const app = creaApp([nonLetta('A')], { api: apiCon('ok') });
    const da = await svuotaEAnnulla(app);
    const a = fotoCon(app, 'A');
    dice('.txt non letto e tornato: resta protetta', true, !!a && S.txtNonLettoInVigore(a));
    dice('...e l\'avviso verde di prima', [[t.undoEmptyDone.replace('{n}', '1'), 'success']], app.notifiche.slice(da));
}
{
    const app = creaApp([nonLetta('A'), foto('B')], { api: apiCon('occupato') });
    const da = await svuotaEAnnulla(app);
    const m = messaggi(app, da);
    dice('una per tipo: le due frasi, ognuna con 1', [true, true], [m.includes(t.undoEmptyTxtNotBackOne), m.includes(t.undoEmptyTxtNotBackUnreadOne)]);
    dice('...l\'avviso non e\' verde', 'info', (app.notifiche[app.notifiche.length - 1] || [])[1]);
}

console.log('\n--- la frase nuova esiste nelle nove lingue, con {n} ---');
for (const [l, testi] of Object.entries(lingue)) {
    dice(`${l}: undoEmptyTxtNotBackUnread con {n}`, true, typeof testi.undoEmptyTxtNotBackUnread === 'string' && testi.undoEmptyTxtNotBackUnread.includes('{n}'));
}

process.exit(esito());
