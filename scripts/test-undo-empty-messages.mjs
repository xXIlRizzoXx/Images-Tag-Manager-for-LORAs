/* ITALIANO: PROVA DEI MESSAGGI DI "ANNULLA LO SVUOTAMENTO"
   Quando il ripescaggio dal Cestino di Windows falliva (PowerShell fermato dopo 60 secondi su un
   Cestino enorme, bloccato dai criteri del PC, risposta illeggibile), l'app diceva "Nel Cestino di
   Windows non e' stato ritrovato nessun file. Forse e' stato svuotato.": mandava l'utente a
   pensare ai file persi mentre erano ancora li'. E il tasto restava per tutta la sessione anche
   per i file che nel Cestino davvero non c'erano piu', ripetendo a ogni clic lo stesso giro. La
   regola: "non trovato" solo quando il Cestino e' stato letto e il file non c'e'; negli altri casi
   si dice che non si e' riusciti a riprenderlo; il tasto resta per cio' che si puo' riprovare.
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-undo-empty-messages.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE "UNDO THE EMPTYING" MESSAGES
   When fishing files out of the Windows Recycle Bin failed (PowerShell stopped after 60 seconds
   on a huge bin, blocked by the PC's policies, unreadable answer), the app said "No file was found
   in the Windows Recycle Bin. It may have been emptied.": it sent the user thinking the files
   were lost while they were still there. And the button stayed for the whole session even for
   files truly gone from the bin, repeating the same round at every click. The rule: "not found"
   only when the bin was read and the file is not there; otherwise it says the file could not be
   taken back; the button stays for what can be retried.
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-undo-empty-messages.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, foto, percorsoImg, lingue, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();

// ITALIANO: A e B svuotate nel Cestino di Windows; poi "Annulla lo svuotamento" con le risposte
//           date da `esitoDi` (o un errore del canale).
// ENGLISH: A and B emptied into the Windows Recycle Bin; then "Undo the emptying" with the answers
//          given by `esitoDi` (or a channel error).
const prova = async (esitoDi) => {
    const api = apiFinta({
        ripristino: (percorsi) => {
            if (esitoDi === 'eccezione') throw new Error('IPC non raggiungibile');
            return { results: percorsi.map(p => ({ percorso: p, esito: esitoDi(p) })) };
        },
    });
    const app = creaApp([foto('A'), foto('B')], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    app.notifiche.length = 0;
    await app.render().annullaSvuotamento();
    await app.attendi();
    return {
        messaggio: app.notifiche[app.notifiche.length - 1],
        restano: (app.stato.ultimoSvuotamento?.voci || []).map(v => v.img.id),
        revocati: app.revocati,
    };
};
const solo = (esitoA, esitoB) => (p) => (p === percorsoImg('A') ? esitoA : esitoB);

console.log('\n--- il ripescaggio fallisce: non e\' "non trovato" ---');
{
    const r = await prova(() => 'fallito');
    dice('tutti "fallito": si dice che non si e\' riusciti, non che il Cestino e\' stato svuotato', [t.undoEmptyFailed, 'error'], r.messaggio);
    dice('il tasto resta, per riprovare', ['A', 'B'], r.restano);
    const e = await prova('eccezione');
    dice('il canale non risponde: stesso messaggio', [t.undoEmptyFailed, 'error'], e.messaggio);
    dice('il tasto resta', ['A', 'B'], e.restano);
    const rif = await prova(() => 'rifiutato');
    dice('tutti "rifiutato": stesso messaggio', [t.undoEmptyFailed, 'error'], rif.messaggio);
    const misto = await prova(solo('nonTrovato', 'fallito'));
    dice('uno non trovato e uno fallito: si dice che non si e\' riusciti', [t.undoEmptyFailed, 'error'], misto.messaggio);
    dice('il tasto resta solo per quello che si puo\' riprovare', ['B'], misto.restano);
}

console.log('\n--- nel Cestino di Windows i file non ci sono piu\' ---');
{
    const r = await prova(() => 'nonTrovato');
    dice('tutti "nonTrovato": "non trovato, forse e\' stato svuotato"', [t.undoEmptyNone, 'error'], r.messaggio);
    dice('il tasto sparisce: non c\'e\' piu\' niente da ripescare', [], r.restano);
    dice('e le loro anteprime si liberano', ['blob:finto/A', 'blob:finto/B'], [...r.revocati].sort());
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const ok = await prova(() => 'ok');
    dice('tutte tornate', [[t.undoEmptyDone.replace('{n}', '2'), 'success'], []], [ok.messaggio, ok.restano]);
    const occ = await prova(() => 'occupato');
    dice('omonimo al loro posto', [[t.undoEmptyBlocked.replace('{n}', '2'), 'info'], ['A', 'B']], [occ.messaggio, occ.restano]);
    const parz = await prova(solo('ok', 'fallito'));
    dice('una tornata e una no', [[t.undoEmptyPartial.replace('{done}', '1').replace('{failed}', '1'), 'info'], ['B']], [parz.messaggio, parz.restano]);
}

console.log('\n--- la frase nuova nelle nove lingue ---');
{
    const mancanti = Object.keys(lingue).filter(l => typeof lingue[l].undoEmptyFailed !== 'string' || !lingue[l].undoEmptyFailed.trim() || lingue[l].undoEmptyFailed === lingue[l].undoEmptyNone);
    dice('undoEmptyFailed c\'e\' in tutte e nove, diversa da undoEmptyNone', [], mancanti);
}

process.exit(esito());
