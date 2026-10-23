/* ITALIANO: PROVA DELL'AVVISO "TAG CAMBIATI DA UN'AI ESTERNA" (SERVER MCP)
   set_tags accetta un solo id: un'AI che tagga 40 foto fa 40 chiamate, e ogni chiamata mostrava
   l'avviso con il numero di quella sola chiamata. Alla fine restava "...: 1. Non sono ancora
   salvati", con 40 foto cambiate. In piu' ogni avviso dell'AI sostituiva subito qualunque altro
   avviso, anche l'errore rosso di "Salva Modifiche". Ora l'avviso conta le foto cambiate
   dall'AI che sono ancora da salvare (ognuna una volta), e non copre un errore ancora a schermo.
   Si esegue il testo VERO del gestore MCP di src/App.tsx con il vero src/utils/mcpBridge.ts e il
   vero fotoDaSalvare (src/utils/closeGuard.ts).
   Casi vicini che non devono cambiare: una chiamata che non cambia niente non mostra avvisi, la
   risposta torna sempre al server, una foto salvata o chiusa non si conta piu', un avviso non
   d'errore viene sostituito come prima.
   Uso:  node scripts/test-mcp-notice-total.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE "TAGS CHANGED BY AN EXTERNAL AI" NOTICE (MCP SERVER)
   set_tags takes one id only: an AI tagging 40 photos makes 40 calls, and every call showed the
   notice with that single call's number. In the end "...: 1. They are not saved yet" stayed, with 40
   photos changed. Also every AI notice at once replaced any other notice, even the red "Save Changes"
   error. Now the notice counts the photos changed by the AI that still need saving (each once), and
   does not cover an error still on screen.
   The REAL text of the MCP handler of src/App.tsx runs with the real src/utils/mcpBridge.ts and the
   real fotoDaSalvare (src/utils/closeGuard.ts).
   Neighbouring cases that must not change: a call changing nothing shows no notice, the answer always
   goes back to the server, a saved or closed photo no longer counts, a non-error notice is replaced
   as before.
   Usage:  node scripts/test-mcp-notice-total.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => {
    const uscita = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const B = await carica('src/utils/mcpBridge.ts');
const G = await carica('src/utils/closeGuard.ts');
const t = (await carica('src/constants.ts')).translations.en;

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
// ITALIANO: due pezzi veri: l'avviso (mcpAvvisoRef, chiamato anche a fine lavoro) e il gestore.
// ENGLISH: two real pieces: the notice (mcpAvvisoRef, also called at the end of the work) and the handler.
const pezzo = (testa) => {
    const inizio = sorgente.indexOf(testa);
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (!fine) { console.log(`NO  "${testa.trim()}" non trovato in src/App.tsx`); process.exit(1); }
    return sorgente.slice(inizio, fine.index + fine[0].length);
};
const codice = (await esbuild.transform(pezzo('    mcpAvvisoRef.current = () => {') + pezzo('    mcpGestoreRef.current = async (r: McpRichiesta) => {'), { loader: 'ts' })).code;
const NOMI = ['mcpGestoreRef', 'eseguiStrumentoMcp', 'imagesRef', 'globalTriggersRef', 'setImages', 'fotoPerMcp', 'fileDiAdesso', 'console',
    'window', 'showNotification', 't', 'setToast', 'fotoDaSalvare', 'mcpCambiateRef', 'mcpFineRef', 'mcpAvvisoRef'];
const muto = { log() { }, warn() { }, error() { } };
const avvisoDi = (n) => (n === 1 ? t.mcpEditedNoticeOne : t.mcpEditedNotice.replace('{n}', String(n)));

// ITALIANO: un'app finta con `quante` foto senza tag; il toast e' uno solo, come in App.tsx.
// ENGLISH: a fake app with `quante` untagged photos; there is a single toast, as in App.tsx.
const app = (quante) => {
    const a = {
        toast: { show: false, message: '', type: 'info', id: 0 }, risposte: [],
        imagesRef: { current: Array.from({ length: quante }, (_, i) => ({ id: 'p' + i, isTrashed: false, tags: [], originalTags: [], file: { name: `p${i}.png` } })) },
    };
    const setToast = (v) => { a.toast = typeof v === 'function' ? v(a.toast) : v; };
    const rif = { current: null };
    const dip = {
        mcpGestoreRef: rif, eseguiStrumentoMcp: B.eseguiStrumentoMcp, imagesRef: a.imagesRef, globalTriggersRef: { current: [] },
        setImages: () => { }, fotoPerMcp: async () => null, fileDiAdesso: async () => null, console: muto,
        window: { electronAPI: { mcp: { respond: (id, r) => a.risposte.push([id, r]) } } },
        showNotification: (message, type = 'info') => setToast({ show: true, message, type, id: Date.now() }),
        t, setToast, fotoDaSalvare: G.fotoDaSalvare, mcpCambiateRef: { current: new Map() },
        mcpFineRef: { current: { inizio: () => { }, fine: (c) => a.fine.push(c), ferma: () => { } } },
        mcpAvvisoRef: { current: null },
    };
    a.fine = [];
    a.fineLavoro = () => dip.mcpAvvisoRef.current();
    new Function(...NOMI, codice)(...NOMI.map(n => dip[n]));
    let n = 0;
    a.chiama = (strumento, argomenti) => rif.current({ id: 'r' + (++n), strumento, argomenti });
    a.salva = () => { a.imagesRef.current = a.imagesRef.current.map(f => ({ ...f, originalTags: f.tags })); };
    a.chiudi = (id) => { a.imagesRef.current = a.imagesRef.current.filter(f => f.id !== id); };
    a.ritocca = (id, tags) => { a.imagesRef.current = a.imagesRef.current.map(f => (f.id === id ? { ...f, tags } : f)); };
    a.ultimo = () => (a.toast.show ? [a.toast.message, a.toast.type] : null);
    return a;
};

console.log('\n--- un\'AI tagga 5 foto con set_tags, una chiamata per foto ---');
{
    const a = app(5);
    for (let i = 0; i < 5; i++) await a.chiama('set_tags', { id: 'p' + i, tags: ['red hair'] });
    dice('l\'avviso alla fine dice 5, non 1', [avvisoDi(5), 'info'], a.ultimo());
    dice('le 5 risposte tornano al server', 5, a.risposte.length);
    await a.chiama('set_tags', { id: 'p2', tags: ['blue eyes'] });
    dice('la stessa foto cambiata ancora conta una volta sola', [avvisoDi(5), 'info'], a.ultimo());
}

console.log('\n--- dopo "Salva Modifiche" e con una foto chiusa ---');
{
    const a = app(4);
    await a.chiama('add_tags', { ids: ['p0', 'p1', 'p2'], tags: ['smile'] });
    dice('add_tags su 3 foto: 3', [avvisoDi(3), 'info'], a.ultimo());
    a.salva();
    await a.chiama('set_tags', { id: 'p3', tags: ['hat'] });
    dice('dopo il salvataggio si contano solo le foto da salvare: 1', [avvisoDi(1), 'info'], a.ultimo());
    await a.chiama('set_tags', { id: 'p0', tags: ['cat'] });
    a.chiudi('p3');
    await a.chiama('set_tags', { id: 'p1', tags: ['dog'] });
    dice('una foto chiusa con la X non si conta piu\'', [avvisoDi(2), 'info'], a.ultimo());
}

// ITALIANO: dopo il salvataggio una foto ritoccata A MANO non e' "cambiata dall'AI": l'avviso contava
//           ancora le foto salvate e poi ritoccate (5 AI, Salva, 3 a mano, 1 AI -> "...: 4").
// ENGLISH: after saving, a photo retouched BY HAND is not "changed by the AI": the notice still counted
//          the photos saved and then retouched (5 AI, Save, 3 by hand, 1 AI -> "...: 4").
console.log('\n--- Salva, ritocchi a mano, poi l\'AI cambia un\'altra foto ---');
{
    const a = app(6);
    for (let i = 0; i < 5; i++) await a.chiama('set_tags', { id: 'p' + i, tags: ['red hair'] });
    dice('prima del salvataggio: 5', [avvisoDi(5), 'info'], a.ultimo());
    a.salva();
    a.ritocca('p0', ['red hair', 'smile']);
    a.ritocca('p1', ['red hair', 'hat']);
    a.ritocca('p2', ['blue eyes']);
    await a.chiama('set_tags', { id: 'p5', tags: ['cat'] });
    dice('le 3 foto salvate e poi ritoccate a mano non si contano: 1', [avvisoDi(1), 'info'], a.ultimo());
    await a.chiama('set_tags', { id: 'p3', tags: ['dog'] });
    dice('una foto salvata che l\'AI cambia di nuovo torna nel conto: 2', [avvisoDi(2), 'info'], a.ultimo());
    a.ritocca('p5', ['cat', 'tail']);
    await a.chiama('set_tags', { id: 'p4', tags: ['fox'] });
    dice('una foto dell\'AI non ancora salvata, ritoccata a mano, resta nel conto: 3', [avvisoDi(3), 'info'], a.ultimo());
}

// ITALIANO: originalTags cambia oggetto anche SENZA salvare la modifica dell'AI: l'AI cambia una foto
//           mentre "Salva Modifiche" scrive (a fine scrittura originalTags = istantanea di prima), oppure
//           l'editor dei file di tag riscrive il .txt (tagDopoEditor tiene i tag non salvati). La foto
//           resta da salvare con il tag dell'AI ma usciva dal conto ("...di una foto" invece di "...: 2").
// ENGLISH: originalTags changes object even WITHOUT saving the AI's change: the AI changes a photo while
//          "Save Changes" writes (at the end originalTags = the earlier snapshot), or the tag file editor
//          rewrites the .txt (tagDopoEditor keeps the unsaved tags). The photo still needs saving with the
//          AI's tag but left the count ("...of a photo" instead of "...: 2").
console.log('\n--- originalTags nuovo senza la modifica dell\'AI (salvataggio in corso, editor dei file di tag) ---');
{
    const S = await carica('src/utils/sidecarTags.ts');
    const a = app(3);
    const istantanea = a.imagesRef.current.map(f => ({ id: f.id, tags: f.tags }));
    await a.chiama('set_tags', { id: 'p0', tags: ['red hair'] });
    a.imagesRef.current = a.imagesRef.current.map(f => ({ ...f, originalTags: [...istantanea.find(s => s.id === f.id).tags] }));
    await a.chiama('set_tags', { id: 'p1', tags: ['hat'] });
    dice('AI durante "Salva Modifiche": la foto ancora da salvare resta nel conto: 2', [avvisoDi(2), 'info'], a.ultimo());
    // ITALIANO: poi un salvataggio vero (originalTags nuovo CON la modifica) la toglie dal conto.
    // ENGLISH: then a real save (new originalTags WITH the change) takes it out of the count.
    a.imagesRef.current = a.imagesRef.current.map(f => ({ ...f, originalTags: [...f.tags] }));
    a.ritocca('p0', ['red hair', 'smile']);
    await a.chiama('set_tags', { id: 'p2', tags: ['cat'] });
    dice('...salvata davvero e poi ritoccata a mano non si conta piu\': 1', [avvisoDi(1), 'info'], a.ultimo());

    const b = app(3);
    await b.chiama('set_tags', { id: 'p0', tags: ['red hair'] });
    b.imagesRef.current = b.imagesRef.current.map(f => (f.id === 'p0' ? { ...f, ...S.tagDopoEditor(f.tags, f.originalTags, ['outdoor'], [], undefined) } : f));
    await b.chiama('set_tags', { id: 'p1', tags: ['hat'] });
    dice('editor dei file di tag dopo l\'AI: la foto con il tag dell\'AI non salvato resta nel conto: 2', [avvisoDi(2), 'info'], b.ultimo());
    // ITALIANO: se l'editor scrive nel .txt anche il tag dell'AI, la modifica e' salvata: esce.
    // ENGLISH: if the editor writes the AI's tag into the .txt too, the change is saved: it leaves.
    const c = app(3);
    await c.chiama('set_tags', { id: 'p0', tags: ['red hair'] });
    c.imagesRef.current = c.imagesRef.current.map(f => (f.id === 'p0' ? { ...f, ...S.tagDopoEditor(f.tags, f.originalTags, ['red hair', 'outdoor'], [], undefined) } : f));
    c.ritocca('p0', ['red hair', 'outdoor', 'smile']);
    await c.chiama('set_tags', { id: 'p1', tags: ['hat'] });
    dice('...se il .txt riscritto contiene il tag dell\'AI la foto esce dal conto: 1', [avvisoDi(1), 'info'], c.ultimo());
}

console.log('\n--- un avviso d\'errore a schermo ---');
{
    const a = app(3);
    a.toast = { show: true, message: 'Save failed: 2 files not written.', type: 'error', id: 1 };
    await a.chiama('set_tags', { id: 'p0', tags: ['red hair'] });
    dice('l\'errore di "Salva Modifiche" resta a schermo', ['Save failed: 2 files not written.', 'error'], a.ultimo());
    dice('...ma la modifica dell\'AI c\'e\' lo stesso e la risposta torna al server', [['red hair'], 1], [a.imagesRef.current[0].tags, a.risposte.length]);
    a.toast = { ...a.toast, show: false };
    await a.chiama('set_tags', { id: 'p1', tags: ['hat'] });
    dice('chiuso l\'errore, l\'avviso dell\'AI conta anche la foto di prima: 2', [avvisoDi(2), 'info'], a.ultimo());
}

// ITALIANO: a fine lavoro (suono) l'avviso torna con il conto di ADESSO, per chi non guardava.
// ENGLISH: at the end of the work (sound) the notice comes back with the count of NOW, for whoever was not looking.
console.log('\n--- a fine lavoro l\'avviso torna ---');
{
    const a = app(4);
    await a.chiama('add_tags', { ids: ['p0', 'p1', 'p2'], tags: ['smile'] });
    a.toast = { ...a.toast, show: false };
    a.fineLavoro();
    dice('l\'avviso sparito ricompare con il conto giusto: 3', [avvisoDi(3), 'info'], a.ultimo());
    a.toast = { ...a.toast, show: false };
    a.chiudi('p2');
    a.fineLavoro();
    dice('...contando solo le foto ancora aperte: 2', [avvisoDi(2), 'info'], a.ultimo());
    a.toast = { ...a.toast, show: false };
    a.salva();
    a.fineLavoro();
    dice('dopo "Salva Modifiche" non ricompare niente', null, a.ultimo());
    const b = app(2);
    await b.chiama('set_tags', { id: 'p0', tags: ['hat'] });
    b.toast = { show: true, message: 'Save failed: 1 file not written.', type: 'error', id: 1 };
    b.fineLavoro();
    dice('non copre un errore ancora a schermo', ['Save failed: 1 file not written.', 'error'], b.ultimo());
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const a = app(2);
    await a.chiama('list_photos', {});
    dice('una chiamata che non cambia niente non mostra avvisi', null, a.ultimo());
    await a.chiama('add_tags', { ids: ['p0'], tags: [] });
    dice('una chiamata sbagliata non mostra avvisi, ma la risposta (con l\'errore) torna al server', [null, 2, true],
        [a.ultimo(), a.risposte.length, typeof a.risposte[1][1].errore === 'string']);
    a.toast = { show: true, message: 'Tags copied', type: 'success', id: 1 };
    await a.chiama('set_tags', { id: 'p1', tags: ['smile'] });
    dice('un avviso non d\'errore viene sostituito come prima', [avvisoDi(1), 'info'], a.ultimo());
}

process.exit(esito());
