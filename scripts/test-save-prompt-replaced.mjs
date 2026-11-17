/* ITALIANO: PROVA DELLA DOMANDA «SOVRASCRIVERE?» SOSTITUITA DA UN'ALTRA FINESTRA DI CONFERMA
   «Salva Modifiche» rilegge i .txt e, se uno e' cambiato da fuori, chiede «Sovrascrivere?» tenendo
   acceso isSaving (Salva, Esporta e Chiudi progetto spenti) finche' non arriva la risposta. Se mentre
   la domanda e' aperta un'altra parte del programma apre la sua finestra di conferma (per esempio la
   seconda conferma «Elimina per sempre» di «Svuota cestino» su una cartella di rete), la domanda
   spariva senza risposta: Salva non finiva mai e isSaving restava acceso per tutta la sessione.
   Ora una domanda sostituita (o chiusa da altri) vale come "no": il .txt cambiato resta com'e', le
   altre foto si salvano, Salva finisce e isSaving si spegne; la finestra nuova resta aperta.
   Casi vicini che non devono cambiare: la risposta normale (Annulla / Sovrascrivi) funziona come
   prima e libera la domanda; una seconda domanda «Sovrascrivere?» (il visualizzatore) che prende il
   posto della prima chiude la prima con "no" e resta lei a chiedere.
   Il verso opposto: una conferma aperta PRIMA della domanda (mentre si rileggono i .txt) veniva coperta
   e spariva senza risposta. Ora resta aperta e Salva vale "no" per i .txt cambiati (l'avviso lo dice);
   una conferma gia' chiusa non conta.
   Si eseguono i testi VERI di handleSaveChanges, performSave, confermaSovrascrittura e dell'effetto
   su confirmDialog (undo-harness.mjs).
   Uso:  node scripts/test-save-prompt-replaced.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE "OVERWRITE?" QUESTION REPLACED BY ANOTHER CONFIRM DIALOG
   "Save Changes" reads the .txt files back and, when one changed from outside, asks "Overwrite?"
   keeping isSaving on (Save, Export and Close project off) until the answer arrives. If, while the
   question was open, another part of the program opened its own confirm dialog (for example the
   second "Delete forever" confirm of "Empty trash" on a network folder), the question vanished
   unanswered: Save never finished and isSaving stayed on for the whole session. Now a replaced (or
   closed by others) question counts as "no": the changed .txt stays as it is, the other photos are
   saved, Save finishes and isSaving goes off; the new dialog stays open.
   Neighbouring cases that must not change: the normal answer (Cancel / Overwrite) works as before
   and frees the question; a second "Overwrite?" question (the viewer) taking the first one's place
   answers the first with "no" and stays open itself.
   The opposite direction: a confirm opened BEFORE the question (while the .txt files are read back) was
   covered and vanished unanswered. Now it stays open and Save counts as "no" for the changed .txt files
   (the notice says so); a confirm already closed does not count.
   The REAL texts of handleSaveChanges, performSave, confermaSovrascrittura and of the effect on
   confirmDialog (undo-harness.mjs) are run.
   Usage:  node scripts/test-save-prompt-replaced.mjs      (exits with code 1 if anything is off) */

import { creaApp, t } from './undo-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();

// ITALIANO: una cartella sul "disco" che si rilegge (come in test-save-txt-changed-outside.mjs).
// ENGLISH: a folder on the "disk" that can be read back (as in test-save-txt-changed-outside.mjs).
// ITALIANO: `ritardo` = ms per ogni rilettura (una cartella di rete lenta).
// ENGLISH: `ritardo` = ms for every read-back (a slow network folder).
const cartella = (voci, ritardo = 0) => {
    const disco = new Map(Object.entries(voci));
    const nonCe = () => new DOMException('not found', 'NotFoundError');
    return {
        disco, name: 'dataset',
        getFileHandle: async (nome, o) => {
            if (!disco.has(nome) && !(o && o.create)) throw nonCe();
            return {
                getFile: async () => {
                    if (ritardo) await new Promise(ok => setTimeout(ok, ritardo));
                    if (!disco.has(nome)) throw nonCe();
                    return new File([disco.get(nome)], nome, { type: 'text/plain' });
                },
                createWritable: async () => { let s = ''; return { write: async (x) => { s += x; }, close: async () => { disco.set(nome, s); } }; },
            };
        },
    };
};
const foto = (id, tags, dir) => ({
    id, file: { name: id + '.png' }, thumb: 'blob:finto/' + id, tags: [...tags], originalTags: [...tags],
    isTrashed: false, dirHandle: dir, width: 1024, height: 1024,
});
const conTrigger = (app) => app.modifica(prev => prev.map(i => ({ ...i, tags: ['ohwx', ...i.tags.filter(x => x !== 'ohwx')] })));
const ESTERNO = '1girl, solo, long hair, smile, outdoors,';
// ITALIANO: la promessa, oppure 'APPESA' se non finisce entro `ms`.
// ENGLISH: the promise, or 'APPESA' (stuck) if it does not finish within `ms`.
const entro = (p, ms = 300) => Promise.race([p, new Promise(ok => setTimeout(() => ok('APPESA'), ms))]);
const aspettaDomanda = async (app) => {
    for (let i = 0; i < 40; i++) {
        await app.attendi(1);
        if (app.stato.confirmDialog && app.stato.confirmDialog.isOpen) return app.stato.confirmDialog;
    }
    return null;
};
// ITALIANO: performSave spegne isSaving mezzo secondo dopo la fine (la barra mostra «Completato»).
// ENGLISH: performSave turns isSaving off half a second after the end (the bar shows "Completed").
const riposo = () => new Promise(ok => setTimeout(ok, 600));
const ultimoSalvando = (app) => { const e = app.eventi.filter(([k]) => k === 'salvando'); return e.length ? e[e.length - 1][1] : null; };
const ELIMINA = { isOpen: true, title: 'Delete forever?', message: 'x', onConfirm: () => { }, onCancel: () => { } };
const prepara = async (ritardo = 0) => {
    const c = cartella({ 'a.png': 'x', 'a.txt': 'cat,', 'b.png': 'x', 'b.txt': 'dog,' }, ritardo);
    const app = creaApp([foto('a', ['cat'], c), foto('b', ['dog'], c)], { trigger: ['ohwx'] });
    app.importa(); await app.attendi();
    c.disco.set('a.txt', ESTERNO);
    conTrigger(app); await app.attendi();
    return { c, app };
};

console.log('\n--- la domanda aperta viene sostituita da un\'altra conferma («Elimina per sempre») ---');
{
    const { c, app } = await prepara();
    const promessa = app.render().handleSaveChanges();
    const domanda = await aspettaDomanda(app);
    dice('premessa: compare «Sovrascrivere?»', t.saveTxtChangedTitle, domanda && domanda.title);
    app.altraDomanda({ ...ELIMINA });
    const ok = await entro(promessa);
    await app.attendi();
    await riposo();
    dice('Salva finisce (non resta appeso) e torna false', false, ok);
    dice('isSaving torna spento (Salva, Esporta e Chiudi progetto di nuovo accesi)', false, ultimoSalvando(app));
    dice('a.txt cambiato da fuori resta com\'e\', b.txt si salva', [ESTERNO, 'ohwx, dog,'], [c.disco.get('a.txt'), c.disco.get('b.txt')]);
    dice('la conferma nuova resta aperta (non la chiude la risposta "no")', [true, 'Delete forever?'], [!!app.stato.confirmDialog.isOpen, app.stato.confirmDialog.title]);
    const ultimo = app.notifiche[app.notifiche.length - 1];
    dice('l\'avviso nomina a.png come non salvata', true, !!ultimo && String(ultimo[0]).includes(t.saveTxtChangedOne.replace('{names}', 'a.png')));
    dice('la domanda non risulta piu\' aperta', null, app.refs.domandaSovrascritturaRef.current);
}

console.log('\n--- la domanda aperta viene chiusa da un\'altra parte del programma (prev => isOpen: false) ---');
{
    const { c, app } = await prepara();
    const promessa = app.render().handleSaveChanges();
    await aspettaDomanda(app);
    app.altraDomanda(prev => ({ ...prev, isOpen: false }));
    const ok = await entro(promessa);
    await app.attendi();
    await riposo();
    dice('Salva finisce, torna false, isSaving spento, a.txt intatto', [false, false, ESTERNO], [ok, ultimoSalvando(app), c.disco.get('a.txt')]);
}

console.log('\n--- quello che NON deve cambiare: la risposta normale ---');
for (const [risposta, atteso, txt] of [['onCancel', false, ESTERNO], ['onConfirm', true, 'ohwx, cat,']]) {
    const { c, app } = await prepara();
    const promessa = app.render().handleSaveChanges();
    const domanda = await aspettaDomanda(app);
    domanda[risposta]();
    const ok = await entro(promessa);
    await app.attendi();
    await riposo();
    dice(`${risposta === 'onCancel' ? 'Annulla' : 'Sovrascrivi'}: Salva torna ${atteso}, a.txt = "${txt}", isSaving spento, domanda chiusa e liberata`,
        [atteso, txt, false, false, null], [ok, c.disco.get('a.txt'), ultimoSalvando(app), !!app.stato.confirmDialog.isOpen, app.refs.domandaSovrascritturaRef.current]);
    // ITALIANO: dopo la risposta, una conferma qualsiasi aperta piu' tardi non tocca niente.
    // ENGLISH: after the answer, any confirm opened later touches nothing.
    app.altraDomanda({ ...ELIMINA });
    await app.attendi();
    dice('...una conferma aperta dopo resta aperta', true, !!app.stato.confirmDialog.isOpen);
}

console.log('\n--- un effetto rimasto indietro (vede ancora la finestra di prima) non chiude la domanda ---');
{
    const { c, app } = await prepara();
    const vecchio = app.render();
    const promessa = app.render().handleSaveChanges();
    const domanda = await aspettaDomanda(app);
    vecchio.effettoDomanda();
    await app.attendi();
    dice('la domanda resta aperta e in attesa', [true, true], [!!app.stato.confirmDialog.isOpen, app.refs.domandaSovrascritturaRef.current !== null]);
    if (domanda) domanda.onConfirm();
    const ok = await entro(promessa);
    dice('...e la risposta vale: Sovrascrivi scrive a.txt', [true, 'ohwx, cat,'], [ok, c.disco.get('a.txt')]);
}

console.log('\n--- una seconda «Sovrascrivere?» (visualizzatore) prende il posto della prima ---');
{
    const { c, app } = await prepara();
    const promessa = app.render().handleSaveChanges();
    const prima = await aspettaDomanda(app);
    const conferma = app.render().confermaSovrascrittura;
    const seconda = conferma([app.fotoCon('a')]);
    let domandaNuova = null;
    for (let i = 0; i < 40 && !domandaNuova; i++) {
        await app.attendi(1);
        if (app.stato.confirmDialog !== prima && app.stato.confirmDialog.isOpen) domandaNuova = app.stato.confirmDialog;
    }
    const ok = await entro(promessa);
    dice('la prima finisce con "no": Salva torna false, a.txt intatto', [false, ESTERNO], [ok, c.disco.get('a.txt')]);
    dice('la seconda resta aperta', true, !!domandaNuova && !!app.stato.confirmDialog.isOpen);
    if (domandaNuova) domandaNuova.onConfirm();
    const esclusi = await entro(seconda);
    dice('...e risponde normalmente (Sovrascrivi: nessuna foto esclusa)', 0, esclusi && esclusi.size);
}

// ITALIANO: il verso opposto: un'altra conferma si apre PRIMA della domanda, mentre Salva rilegge i .txt
//           (cartella lenta). La domanda la sostituiva: «Elimina per sempre» spariva senza risposta e lo
//           svuotamento non partiva mai. Ora la conferma aperta resta e risponde; Salva vale "no" per i .txt
//           cambiati (restano come sono, l'avviso lo dice) e scrive le altre foto.
// ENGLISH: the opposite direction: another confirm opens BEFORE the question, while Save reads the .txt
//          files back (slow folder). The question replaced it: "Delete forever" vanished unanswered and the
//          emptying never started. Now the open confirm stays and answers; Save counts as "no" for the
//          changed .txt files (they stay as they are, the notice says so) and writes the other photos.
console.log('\n--- una conferma aperta mentre Salva rilegge i .txt («Elimina per sempre») non viene coperta ---');
{
    const { c, app } = await prepara(40);
    const promessa = app.render().handleSaveChanges();
    const risposte = [];
    const elimina = { ...ELIMINA, onConfirm: () => risposte.push('elimina'), onCancel: () => risposte.push('annulla') };
    app.altraDomanda(elimina);
    await app.attendi();
    const ok = await entro(promessa, 1500);
    await app.attendi();
    await riposo();
    dice('Salva finisce da solo, senza una domanda sopra la conferma (non resta appeso)', true, ok !== 'APPESA');
    dice('la conferma aperta resta quella, aperta', [true, true, 'Delete forever?'], [app.stato.confirmDialog === elimina, !!app.stato.confirmDialog.isOpen, app.stato.confirmDialog.title]);
    dice('Salva finisce con "no": torna false, isSaving spento, domanda libera', [false, false, null], [ok, ultimoSalvando(app), app.refs.domandaSovrascritturaRef.current]);
    dice('a.txt cambiato da fuori resta com\'e\', b.txt si salva', [ESTERNO, 'ohwx, dog,'], [c.disco.get('a.txt'), c.disco.get('b.txt')]);
    const ultimo = app.notifiche[app.notifiche.length - 1];
    dice('l\'avviso nomina a.png come non salvata', true, !!ultimo && String(ultimo[0]).includes(t.saveTxtChangedOne.replace('{names}', 'a.png')));
    app.stato.confirmDialog.onConfirm();
    dice('«Elimina per sempre» riceve la sua risposta', ['elimina'], risposte);
}
{
    // ITALIANO: casi vicini: una conferma gia' CHIUSA (prev => isOpen: false, il titolo resta) non conta: la
    //           domanda compare e la risposta vale; lo stesso per il visualizzatore senza conferme aperte.
    // ENGLISH: neighbouring cases: a confirm already CLOSED (prev => isOpen: false, the title stays) does not
    //          count: the question shows up and the answer counts; the same for the viewer with no open confirm.
    const { c, app } = await prepara(300);
    const promessa = app.render().handleSaveChanges();
    app.altraDomanda({ ...ELIMINA });
    app.altraDomanda(prev => ({ ...prev, isOpen: false }));
    let domanda = null;
    for (let i = 0; i < 200 && !domanda; i++) {
        await new Promise(ok => setTimeout(ok, 5));
        if (app.stato.confirmDialog.isOpen && app.stato.confirmDialog.title === t.saveTxtChangedTitle) domanda = app.stato.confirmDialog;
    }
    dice('conferma gia\' chiusa: la domanda compare', true, !!domanda);
    if (domanda) domanda.onConfirm();
    const ok = await entro(promessa, 1500);
    dice('...e Sovrascrivi scrive a.txt', [true, 'ohwx, cat,'], [ok, c.disco.get('a.txt')]);
}
{
    // ITALIANO: il visualizzatore («Salva file .txt») con una conferma aperta: niente domanda sopra, vale "no".
    // ENGLISH: the viewer ("Save .txt file") with a confirm open: no question on top, it counts as "no".
    const { c, app } = await prepara();
    app.altraDomanda({ ...ELIMINA });
    await app.attendi();
    const esclusi = await entro(app.render().confermaSovrascrittura([app.fotoCon('a')]));
    dice('visualizzatore con una conferma aperta: a.png esclusa, la conferma resta, a.txt intatto',
        [true, 'Delete forever?', ESTERNO], [!!esclusi && esclusi.has && esclusi.has('a'), app.stato.confirmDialog.title, c.disco.get('a.txt')]);
}

process.exit(esito());
