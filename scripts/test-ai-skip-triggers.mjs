/* ITALIANO: PROVA DI "SALTA FOTO GIA' TAGGATE" CON UNA TRIGGER WORD IMPOSTATA
   Il flusso normale di chi addestra una LoRA: si apre una cartella senza tag, si scrive la trigger
   ("ohwx") nel riquadro delle trigger word, che la mette su ogni foto, e si preme "Tagga tutte con
   AI". Con "Salta foto gia' taggate" acceso (com'e' all'inizio) ogni foto risultava gia' taggata
   per via della trigger: nessuna partiva e il riepilogo diceva "Foto taggate: 0. Saltate: N.". La
   regola: le trigger word non contano come tag; una foto con un tag vero resta saltata.
   Si eseguono i testi VERI presi da src/App.tsx (vedi ai-batch-harness.mjs) e la regola vera di
   src/utils/tagCase.ts.
   Uso:  node scripts/test-ai-skip-triggers.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "SKIP ALREADY-TAGGED PHOTOS" WITH A TRIGGER WORD SET
   The normal flow of a LoRA trainer: open a folder with no tags, type the trigger ("ohwx") in the
   trigger word box, which puts it on every photo, and press "Auto-tag all with AI". With "Skip
   already-tagged photos" on (as it is at first) every photo looked already tagged because of the
   trigger: none was sent and the summary said "Photos tagged: 0. Skipped: N.". The rule: trigger
   words do not count as tags; a photo with a real tag is still skipped.
   The REAL code taken from src/App.tsx is run (see ai-batch-harness.mjs), plus the real rule of
   src/utils/tagCase.ts.
   Usage:  node scripts/test-ai-skip-triggers.mjs      (exits with code 1 if anything is off) */

import { nuovaApp, BUONA, t, tagCase } from './ai-batch-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const riepilogo = (n) => t.aiBatchDone.replace('{ok}', String(n.ok)).replace('{err}', '0').replace('{skip}', String(n.skip)).replace('{n}', String(n.tag));

console.log('\n--- la regola ---');
{
    const oltre = tagCase.hasTagsBeyondTriggers;
    dice('la regola esiste', 'function', typeof oltre);
    if (typeof oltre === 'function') {
        dice('solo la trigger: non e\' taggata', false, oltre(['ohwx'], ['ohwx']));
        dice('la trigger scritta in un altro modo: non e\' taggata', false, oltre(['OHWX'], ['ohwx']));
        dice('nessun tag: non e\' taggata', false, oltre([], ['ohwx']));
        dice('trigger piu\' un tag vero: e\' taggata', true, oltre(['ohwx', 'smile'], ['ohwx']));
        dice('un tag senza trigger impostate: e\' taggata', true, oltre(['smile'], []));
    }
}

console.log('\n--- "Tagga tutte con AI" con la trigger "ohwx" e "Salta foto gia\' taggate" acceso ---');
{
    const app = nuovaApp([{ id: 'f1', tags: ['ohwx'] }, { id: 'f2', tags: ['ohwx'] }, { id: 'f3', tags: ['ohwx', 'smile'] }],
        () => BUONA, { skip: true, trigger: ['ohwx'] });
    await app.tutte();
    dice('partono le due foto che hanno solo la trigger', 2, app.chiamate());
    dice('la trigger resta la prima', ['ohwx', 'cat', 'sofa'], app.foto[0].tags);
    dice('la foto con un tag vero resta saltata', ['ohwx', 'smile'], app.foto[2].tags);
    dice('il riepilogo lo dice', [riepilogo({ ok: 2, skip: 1, tag: 4 }), 'success'], app.notifiche[app.notifiche.length - 1]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const senzaTrigger = nuovaApp([{ id: 'f1', tags: ['smile'] }, { id: 'f2' }], () => BUONA, { skip: true });
    await senzaTrigger.tutte();
    dice('senza trigger: la foto con un tag e\' saltata, quella vuota no', [1, ['smile']], [senzaTrigger.chiamate(), senzaTrigger.foto[0].tags]);
    const spento = nuovaApp([{ id: 'f1', tags: ['ohwx', 'smile'] }], () => BUONA, { skip: false, trigger: ['ohwx'] });
    await spento.tutte();
    dice('con "Salta" spento si tagga anche la foto con tag', 1, spento.chiamate());
}

process.exit(esito());
