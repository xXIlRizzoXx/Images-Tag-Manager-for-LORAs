/* ITALIANO: PROVA DEL .txt IN COMUNE FRA DUE FOTO CON LO STESSO NOME (a.png e a.jpg)
   In una cartella con a.png, a.jpg (un doppione convertito) e un solo a.txt, l'import da' i tag di
   a.txt a tutte e due, e Kohya fa lo stesso. Cestinando solo a.png e svuotando il cestino (o con
   la X, o con "Elimina per sempre" su chiavette e schede SD), insieme ad a.png se ne andava anche
   a.txt: a.jpg restava in galleria "salvata", ma senza piu' il suo .txt sul disco, e sulla strada
   senza Cestino di Windows la didascalia era persa per sempre, con un messaggio verde.
   La regola: il .txt se ne va solo con l'ultima foto che lo usa.
   Si eseguono i testi VERI del cestino presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-trash-shared-txt.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE .txt SHARED BY TWO PHOTOS WITH THE SAME NAME (a.png and a.jpg)
   In a folder with a.png, a.jpg (a converted duplicate) and a single a.txt, the import gives
   a.txt's tags to both, and Kohya does the same. Trashing only a.png and emptying the trash (or
   with the X, or with "Delete for good" on USB sticks and SD cards), a.txt went away together
   with a.png: a.jpg stayed in the gallery "saved", but with no .txt left on disk, and on the road
   without a Windows Recycle Bin the caption was lost for good, with a green message.
   The rule: the .txt leaves only with the last photo that uses it.
   The REAL trash code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-trash-shared-txt.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, cartellaFinta, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();

const foto = (id, nome, { cestinata = true, cartella = null, dove = 'E:\\dataset\\' } = {}) => ({
    id, file: { name: nome, percorso: dove + nome }, thumb: 'blob:finto/' + id,
    tags: ['smile', 'red dress'], originalTags: ['smile', 'red dress'], isTrashed: cestinata, dirHandle: cartella,
});
const inviati = (api) => api.chiamate.flat();
const TXT = 'E:\\dataset\\a.txt';

console.log('\n--- Svuota cestino: a.png nel cestino, a.jpg in galleria ---');
{
    const api = apiFinta();
    const app = creaApp([foto('PNG', 'a.png'), foto('JPG', 'a.jpg', { cestinata: false })], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('nel Cestino di Windows va solo a.png', ['E:\\dataset\\a.png'], inviati(api));
    dice('a.jpg resta in galleria', ['JPG'], app.vista());
    dice('il messaggio e\' quello normale', [[t.deleteSuccess, 'success']], app.notifiche);
    // ITALIANO: "Annulla lo svuotamento" non deve chiedere indietro un a.txt mai spostato.
    // ENGLISH: "Undo the emptying" must not ask back an a.txt that was never moved.
    await app.render().annullaSvuotamento();
    await app.attendi();
    dice('l\'annullamento chiede indietro solo a.png', [['E:\\dataset\\a.png']], api.ripristini);
}

console.log('\n--- la X su a.png, a.jpg in galleria ---');
{
    const api = apiFinta();
    const app = creaApp([foto('PNG', 'a.png'), foto('JPG', 'a.jpg', { cestinata: false })], { api });
    await app.render().handleDeletePermanently('PNG');
    await app.attendi();
    dice('nel Cestino di Windows va solo a.png', ['E:\\dataset\\a.png'], inviati(api));
    dice('a.jpg resta in galleria', ['JPG'], app.vista());
}

console.log('\n--- la X su a.png, a.jpg anche lei nel cestino dell\'app ma non scelta ---');
{
    const api = apiFinta();
    const app = creaApp([foto('PNG', 'a.png'), foto('JPG', 'a.jpg')], { api });
    await app.render().handleDeletePermanently('PNG');
    await app.attendi();
    dice('a.txt resta per a.jpg, che si puo\' ancora ripristinare', ['E:\\dataset\\a.png'], inviati(api));
    // ITALIANO: poi la X anche su a.jpg: ora e' l'ultima, il .txt va con lei.
    // ENGLISH: then the X on a.jpg too: now it is the last one, the .txt goes with it.
    await app.render().handleDeletePermanently('JPG');
    await app.attendi();
    dice('con l\'ultima foto se ne va anche a.txt', ['E:\\dataset\\a.png', 'E:\\dataset\\a.jpg', TXT], inviati(api));
}

console.log('\n--- Elimina per sempre (chiavetta / scheda SD): a.png nel cestino, a.jpg in galleria ---');
{
    const cartella = cartellaFinta();
    const api = apiFinta({ esitoDi: () => 'rifiutato' });
    const app = creaApp([foto('PNG', 'a.png', { cartella }), foto('JPG', 'a.jpg', { cestinata: false, cartella })], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    await app.stato.confirmDialog.onConfirm();
    await app.attendi();
    dice('dalla cartella si cancella solo a.png', ['a.png'], cartella.rimossi);
    dice('a.jpg resta in galleria', ['JPG'], app.vista());
}

console.log('\n--- Elimina per sempre nell\'anteprima del browser (nessun percorso, solo la cartella) ---');
{
    const cartella = cartellaFinta();
    const app = creaApp([foto('PNG', 'a.png', { cartella }), foto('JPG', 'a.jpg', { cestinata: false, cartella })]);
    await app.render().handleEmptyTrash();
    await app.attendi();
    await app.stato.confirmDialog.onConfirm();
    await app.attendi();
    dice('dalla cartella si cancella solo a.png', ['a.png'], cartella.rimossi);
}

console.log('\n--- quello che NON deve cambiare: tutte e due svuotate insieme ---');
{
    const api = apiFinta();
    const app = creaApp([foto('PNG', 'a.png'), foto('JPG', 'a.jpg')], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    const lista = inviati(api);
    dice('a.txt va nel Cestino di Windows una volta sola', 1, lista.filter(p => p === TXT).length);
    dice('e ci vanno anche le due immagini', true, lista.includes('E:\\dataset\\a.png') && lista.includes('E:\\dataset\\a.jpg'));
    dice('la galleria e il cestino sono vuoti', [], app.vista());
    await app.render().annullaSvuotamento();
    await app.attendi();
    dice('l\'annullamento chiede indietro anche a.txt', true, api.ripristini.flat().includes(TXT));
}
{
    const cartella = cartellaFinta();
    const api = apiFinta({ esitoDi: () => 'rifiutato' });
    const app = creaApp([foto('PNG', 'a.png', { cartella }), foto('JPG', 'a.jpg', { cartella })], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    await app.stato.confirmDialog.onConfirm();
    await app.attendi();
    dice('per sempre: a.txt si cancella una volta sola, con le due immagini', ['a.jpg', 'a.png', 'a.txt'], [...cartella.rimossi].sort());
}

console.log('\n--- quello che NON deve cambiare: l\'altra foto non ce la fa ---');
{
    // ITALIANO: a.jpg bloccata resta nel cestino dell'app: il .txt resta con lei.
    // ENGLISH: a locked a.jpg stays in the app's trash: the .txt stays with it.
    const api = apiFinta({ esitoDi: (p) => (p === 'E:\\dataset\\a.jpg' ? 'errore' : 'ok') });
    const app = creaApp([foto('PNG', 'a.png'), foto('JPG', 'a.jpg')], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('a.txt non va nel Cestino di Windows', false, inviati(api).includes(TXT));
    dice('a.jpg resta nel cestino dell\'app', ['JPG(cestino)'], app.vista());
}

console.log('\n--- quello che NON deve cambiare: stesso nome in un\'altra cartella ---');
{
    const api = apiFinta();
    const app = creaApp([foto('PNG', 'a.png'), foto('JPG', 'a.jpg', { cestinata: false, dove: 'E:\\altro\\' })], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('a.txt della sua cartella se ne va con a.png', ['E:\\dataset\\a.png', TXT], inviati(api));
}
{
    const cartella = cartellaFinta();
    const altra = cartellaFinta();
    const app = creaApp([foto('PNG', 'a.png', { cartella }), foto('JPG', 'a.jpg', { cestinata: false, cartella: altra })]);
    await app.render().handleEmptyTrash();
    await app.attendi();
    await app.stato.confirmDialog.onConfirm();
    await app.attendi();
    dice('per sempre, altra cartella: a.txt se ne va con a.png', ['a.png', 'a.txt'], cartella.rimossi);
    dice('e nell\'altra cartella non si tocca niente', [], altra.rimossi);
}

console.log('\n--- quello che NON deve cambiare: una foto sola con il suo .txt ---');
{
    const api = apiFinta();
    const app = creaApp([foto('PNG', 'a.png'), foto('B', 'b.jpg', { cestinata: false })], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('a.png e a.txt vanno nel Cestino di Windows', ['E:\\dataset\\a.png', TXT], inviati(api));
}

process.exit(esito());
