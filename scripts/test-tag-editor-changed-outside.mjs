/* ITALIANO: PROVA DI «SALVA» DELL'EDITOR DEI FILE DI TAG CON IL FILE CAMBIATO DA UN ALTRO PROGRAMMA
   L'editor dei file di tag e' aperto su a.txt. Intanto un altro programma (il tagger WD14 di Kohya,
   il Blocco note) riscrive a.txt. Si cambia un tag nell'editor e si preme Salva: a.txt veniva
   sostituito senza nessuna domanda e i tag scritti dall'altro programma si perdevano (la stessa
   classe di «Salva Modifiche», gia' coperta). Ora prima di scrivere l'editor rilegge il file: se i tag
   non sono piu' quelli che conosce chiede «Sovrascrivere?» (gli stessi testi del progetto). Con
   Annulla il file resta com'e', Salva torna false e «Salva e chiudi» non chiude; con la conferma si
   scrive come prima.
   Casi vicini che non devono cambiare: nessun cambio da fuori, o gli stessi tag in un altro ordine,
   non chiedono niente; due Salva di fila non chiedono; un file cancellato da fuori si riscrive senza
   chiedere; un handle che non si rilegge (senza getFile) si scrive come prima; un .json funziona allo
   stesso modo (anche nella forma del progetto con le trigger); un file oltre 1 MB o un JSON rotto
   contano come cambiati; chiudere l'editor con la domanda aperta vale "no".
   Anche: un tag con un TAB (incollato) non fa chiedere «Sovrascrivere?» al Salva dopo; la domanda
   dell'editor ha un testo suo (tagEditorFileChangedAsk), non quello delle foto.
   Si eseguono i testi VERI di parseTagFile, fileTagCambiato, chiediSovrascrittura, salva e
   salvaEChiudiFile presi da src/components/TagFileEditor.tsx (compilati con esbuild).
   Uso:  node scripts/test-tag-editor-changed-outside.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE TAG FILE EDITOR'S "SAVE" WITH THE FILE CHANGED BY ANOTHER PROGRAM
   The tag file editor is open on a.txt. Meanwhile another program (Kohya's WD14 tagger, Notepad)
   rewrites a.txt. A tag is changed in the editor and Save is pressed: a.txt was replaced with no
   question and the tags written by the other program were lost (the same class as "Save Changes",
   already covered). Now before writing the editor reads the file back: if the tags are no longer the
   ones it knows it asks "Overwrite?" (the same strings as the project). With Cancel the file stays as
   it is, Save returns false and "Save and close" does not close; when confirmed it is written as
   before.
   Neighbouring cases that must not change: no change from outside, or the same tags in another
   order, ask nothing; two Saves in a row do not ask; a file deleted from outside is written again
   without asking; a handle that cannot be read back (no getFile) is written as before; a .json works
   the same way (also in the project shape with triggers); a file over 1 MB or broken JSON count as
   changed; closing the editor with the question open counts as "no".
   Also: a tag with a (pasted) TAB does not make the next Save ask "Overwrite?"; the editor's question
   has its own string (tagEditorFileChangedAsk), not the photos' one.
   The REAL texts of parseTagFile, fileTagCambiato, chiediSovrascrittura, salva and salvaEChiudiFile
   from src/components/TagFileEditor.tsx are run (compiled with esbuild).
   Usage:  node scripts/test-tag-editor-changed-outside.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const sorgente = fs.readFileSync(path.join(radice, 'src/components/TagFileEditor.tsx'), 'utf8');
const carica = async (rel) => {
    const u = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
};
const S = await carica('src/utils/sidecarTags.ts');
const lingue = (await carica('src/constants.ts')).translations;
const t = lingue.en;

// ITALIANO: un pezzo vero; `riserva` = il testo da usare se sul codice di prima non c'e'.
// ENGLISH: a real piece; `riserva` = the text to use when the previous code does not have it.
const ritaglia = (intestazione, chiusura, riserva = null) => {
    const inizio = sorgente.indexOf(intestazione);
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (inizio < 0 || !fine) {
        if (riserva !== null) return riserva;
        console.log('NO  non trovato in src/components/TagFileEditor.tsx: ' + intestazione.trim());
        process.exit(1);
    }
    return sorgente.slice(inizio, fine.index + fine[0].length).replace(/^export /, '');
};
const fuori = /\r?\n\};\r?\n/g;
const dentro = /\r?\n    \};\r?\n/g;
const pezzi = [
    'const EDITOR_MAX_BYTES = 1024 * 1024;',
    ritaglia('const SEMBRA_JSON = ', /;\r?\n/g),
    ritaglia('export const parseTagFile = (', fuori),
    ritaglia('export const parseTagTriggers = (', fuori),
    ritaglia('export const parseTagShape = (', fuori),
    ritaglia('export const serializeTagFile = (', fuori),
    // ITALIANO: sul codice di prima non ci sono: la prova mostra lo stesso il comportamento sbagliato.
    // ENGLISH: absent in the old code: the test still shows the wrong behaviour.
    ritaglia('export const fileTagCambiato = async (', fuori, 'const fileTagCambiato = async () => false;'),
    ritaglia('    const chiediSovrascrittura = () => ', /\r?\n    \}\);\r?\n/g, 'const chiediSovrascrittura = async () => true;'),
    ritaglia('    const salvaEChiudiFile = async () => {', dentro),
    ritaglia('    const salva = async (forzaNuovoFile = false): Promise<boolean> => {', dentro),
];
// ITALIANO: l'effetto che chiude con "no" la domanda quando l'editor si chiude (riga sola).
// ENGLISH: the effect that answers "no" when the editor closes (single line).
const rigaChiusura = sorgente.split(/\r?\n/).find(r => r.includes('useEffect(() => { if (!isOpen && rispostaSovrascritturaRef.current)'));
const effettoChiusura = rigaChiusura ? rigaChiusura.trim().replace(/^useEffect\(/, 'const effettoChiusura = (').replace(/, \[isOpen\]\);$/, ');') : 'const effettoChiusura = () => { };';
const codice = (await esbuild.transform(pezzi.join('\n') + '\n' + effettoChiusura, { loader: 'ts' })).code;
const fabbrica = new Function('tags', 'fileName', 'rileggendo', 'handleRef', 'triggersRef', 'formaJsonRef', 'savedTagsRef', 'tagsRef', 'setDirty', 'setFileName',
    'setChiusuraFile', 'azzera', 'soundManager', 'showNotification', 't', 'onFileSaved', 'window', 'document', 'URL', 'Blob',
    'inAttesa', 'setTags', 'setInputValue', 'uniqueTagsIgnoringCase', 'hasTagIgnoringCase', 'leggiTestoSidecar',
    'rispostaSovrascritturaRef', 'setDomandaSovrascrittura', 'isOpen',
    codice + '\nreturn { salva, salvaEChiudiFile, effettoChiusura, parseTagFile };');

// ITALIANO: un file sul "disco": `testo` = contenuto di adesso (null = cancellato); senza `conGetFile`
//           l'handle non si rilegge (come quelli finti delle prove vecchie).
// ENGLISH: a file on the "disk": `testo` = current content (null = deleted); without `conGetFile` the
//          handle cannot be read back (like the old tests' fake ones).
const fileSulDisco = (nome, testo, { conGetFile = true } = {}) => {
    const f = { name: nome, testo, scritture: [] };
    f.createWritable = async () => { let s = ''; return { write: async (x) => { s += x; }, close: async () => { f.testo = s; f.scritture.push(s); } }; };
    if (conGetFile) f.getFile = async () => {
        if (f.testo === null) throw new DOMException('not found', 'NotFoundError');
        return new File([f.testo], nome, { type: 'text/plain' });
    };
    return f;
};
// ITALIANO: l'editor finto aperto su `file`, con i tag `letti` (come li ha letti all'apertura) e `tags`
//           mostrati adesso. `domanda` = la domanda «Sovrascrivere?» e' aperta; `rispondi(si)` risponde.
// ENGLISH: the fake editor open on `file`, with the tags `letti` (as read when opened) and `tags`
//          shown now. `domanda` = the "Overwrite?" question is open; `rispondi(si)` answers it.
const editor = (file, letti, tags, { triggers = [], isOpen = true } = {}) => {
    const r = { notifiche: [], sincronizzati: [], chiuso: false, domanda: false, domande: 0 };
    const refs = { handleRef: { current: file }, savedTagsRef: { current: [...letti] }, tagsRef: { current: tags }, risposta: { current: null } };
    r.refs = refs;
    r.fn = () => fabbrica(tags, file.name, false, refs.handleRef, { current: triggers }, { current: null }, refs.savedTagsRef, refs.tagsRef,
        () => { }, () => { }, () => { }, () => { r.chiuso = true; }, { chime() { }, pop() { } }, (m, tipo) => r.notifiche.push([m, tipo]), t,
        (nome, lista) => r.sincronizzati.push([nome, lista]), {}, {}, URL, Blob,
        () => [], () => { }, () => { }, (l) => [...new Set(l)], (l, x) => l.includes(x), S.leggiTestoSidecar,
        refs.risposta, (v) => { r.domanda = v; if (v) r.domande++; }, isOpen);
    r.rispondi = (si) => { if (refs.risposta.current) refs.risposta.current(si); };
    return r;
};
const attendi = async () => { for (let i = 0; i < 10; i++) await new Promise(ok => setTimeout(ok, 0)); };
// ITALIANO: preme Salva; se compare la domanda risponde `risposta` (true = sovrascrivi).
// ENGLISH: presses Save; if the question shows up it answers `risposta` (true = overwrite).
const salva = async (r, risposta = false, come = 'salva') => {
    const p = come === 'salva' ? r.fn().salva(false) : r.fn().salvaEChiudiFile();
    await attendi();
    const chiesto = r.domanda;
    r.rispondi(risposta);
    const ok = await p;
    return { ok, chiesto };
};
const ESTERNO = '1girl, solo, long hair, outdoors,';

console.log('\n--- a.txt riscritto da un altro programma con l\'editor aperto ---');
{
    const f = fileSulDisco('a.txt', 'cat, dog,');
    const r = editor(f, ['cat', 'dog'], ['cat', 'dog', 'smile']);
    f.testo = ESTERNO;
    const { ok, chiesto } = await salva(r, false);
    dice('Salva chiede «Sovrascrivere?» prima di scrivere', true, chiesto);
    dice('...con Annulla a.txt resta quello dell\'altro programma', [ESTERNO, []], [f.testo, f.scritture]);
    dice('...Salva torna false, niente avviso verde, la foto nel progetto non cambia', [false, [], []],
        [ok, r.notifiche.filter(([, tipo]) => tipo === 'success'), r.sincronizzati]);
    dice('...la domanda si chiude', false, r.domanda);
}
{
    const f = fileSulDisco('a.txt', 'cat, dog,');
    const r = editor(f, ['cat', 'dog'], ['cat', 'dog', 'smile']);
    f.testo = ESTERNO;
    const { ok, chiesto } = await salva(r, true);
    dice('con la conferma si scrive come prima', [true, true, 'cat, dog, smile,', [['a.txt', ['cat', 'dog', 'smile']]]],
        [chiesto, ok, f.testo, r.sincronizzati]);
}
{
    const f = fileSulDisco('a.txt', 'cat, dog,');
    const r = editor(f, ['cat', 'dog'], ['cat', 'dog', 'smile']);
    f.testo = ESTERNO;
    const { chiesto } = await salva(r, false, 'chiudi');
    dice('«Salva e chiudi» con Annulla: chiede, non scrive e non chiude il file', [true, ESTERNO, false], [chiesto, f.testo, r.chiuso]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const f = fileSulDisco('a.txt', 'cat, dog,');
    const r = editor(f, ['cat', 'dog'], ['cat', 'dog', 'smile']);
    const a = await salva(r, false);
    dice('nessun cambio da fuori: nessuna domanda, scritto', [false, true, 'cat, dog, smile,'], [a.chiesto, a.ok, f.testo]);
    // ITALIANO: il secondo Salva vede quello che ha scritto il primo (savedTagsRef aggiornato).
    // ENGLISH: the second Save sees what the first one wrote (savedTagsRef updated).
    r.refs.savedTagsRef.current = ['cat', 'dog', 'smile'];
    const b = await salva(r, false);
    dice('due Salva di fila: il secondo non chiede', [false, true], [b.chiesto, b.ok]);
}
{
    const f = fileSulDisco('a.txt', 'cat, dog,');
    const r = editor(f, ['cat', 'dog'], ['cat', 'dog', 'smile']);
    f.testo = ' dog ,\r\ncat';
    const a = await salva(r, false);
    dice('stessi tag in un altro ordine e con altri spazi: nessuna domanda', [false, true], [a.chiesto, a.ok]);
}
{
    const f = fileSulDisco('a.txt', 'cat,');
    const r = editor(f, ['cat'], ['cat', 'smile']);
    f.testo = null;
    const a = await salva(r, false);
    dice('file cancellato da fuori: si riscrive senza chiedere', [false, true, 'cat, smile,'], [a.chiesto, a.ok, f.testo]);
}
{
    const f = fileSulDisco('a.txt', 'cat,', { conGetFile: false });
    const r = editor(f, ['cat'], ['cat', 'smile']);
    f.testo = ESTERNO;
    const a = await salva(r, false);
    dice('handle che non si rilegge: si scrive come prima', [false, true, 'cat, smile,'], [a.chiesto, a.ok, f.testo]);
}
{
    const f = fileSulDisco('a.txt', 'cat,');
    const r = editor(f, ['cat'], ['cat', 'smile']);
    f.testo = 'x'.repeat(1024 * 1024 + 10);
    const a = await salva(r, false);
    dice('file oltre 1 MB scritto da fuori: conta come cambiato (si chiede)', [true, false], [a.chiesto, a.ok]);
}

console.log('\n--- file .json ---');
{
    const f = fileSulDisco('tags.json', JSON.stringify(['cat', 'dog'], null, 2));
    const r = editor(f, ['cat', 'dog'], ['cat', 'dog', 'smile']);
    f.testo = JSON.stringify(['cat', 'dog', 'outdoors'], null, 2);
    const a = await salva(r, false);
    dice('.json (elenco) cambiato da fuori: si chiede e resta com\'e\'', [true, false, JSON.stringify(['cat', 'dog', 'outdoors'], null, 2)], [a.chiesto, a.ok, f.testo]);
}
{
    const progetto = JSON.stringify({ app: 'Images Tag Manager for LORAs', type: 'project-tags', version: 1, globalTriggers: ['ohwx'], tags: ['cat'] }, null, 2);
    const f = fileSulDisco('progetto.json', progetto);
    const r = editor(f, ['ohwx', 'cat'], ['ohwx', 'cat', 'smile'], { triggers: ['ohwx'] });
    const a = await salva(r, false);
    dice('.json del progetto con le trigger, non cambiato: nessuna domanda, scritto', [false, true], [a.chiesto, a.ok]);
}
{
    const f = fileSulDisco('tags.json', '["cat"]');
    const r = editor(f, ['cat'], ['cat', 'smile']);
    f.testo = '{"tags": ["cat",';
    const a = await salva(r, false);
    dice('.json rotto da fuori: conta come cambiato (si chiede)', [true, false], [a.chiesto, a.ok]);
}

console.log('\n--- l\'editor si chiude con la domanda aperta ---');
{
    const f = fileSulDisco('a.txt', 'cat,');
    const r = editor(f, ['cat'], ['cat', 'smile']);
    f.testo = ESTERNO;
    const p = r.fn().salva(false);
    await attendi();
    const chiesto = r.domanda;
    // ITALIANO: il render con isOpen = false fa girare l'effetto di chiusura vero.
    // ENGLISH: the render with isOpen = false runs the real closing effect.
    fabbrica(['cat', 'smile'], 'a.txt', false, { current: f }, { current: [] }, { current: null }, { current: ['cat'] }, { current: [] },
        () => { }, () => { }, () => { }, () => { }, { chime() { }, pop() { } }, () => { }, t, () => { }, {}, {}, URL, Blob,
        () => [], () => { }, () => { }, (l) => [...new Set(l)], (l, x) => l.includes(x), S.leggiTestoSidecar,
        r.refs.risposta, (v) => { r.domanda = v; }, false).effettoChiusura();
    const esito1 = await Promise.race([p, new Promise(ok => setTimeout(() => ok('APPESO'), 300))]);
    dice('il salvataggio finisce con "no": file intatto, Salva torna false, domanda chiusa', [true, false, ESTERNO, false], [chiesto, esito1, f.testo, r.domanda]);
}

// ITALIANO: un tag con un carattere di controllo (un TAB incollato nella casella) si scrive col TAB e
//           parseTagFile lo rilegge con uno spazio: il Salva dopo chiedeva «Sovrascrivere?» anche se fuori
//           non era cambiato niente. Ora i tag ricordati passano dalla stessa pulizia.
// ENGLISH: a tag with a control character (a TAB pasted into the box) is written with the TAB and
//          parseTagFile reads it back with a space: the next Save asked "Overwrite?" although nothing had
//          changed outside. Now the remembered tags go through the same cleaning.
console.log('\n--- un tag con un TAB dentro (incollato nella casella) ---');
{
    const f = fileSulDisco('a.txt', 'cat,');
    const r = editor(f, ['cat'], ['cat', 'a\tb']);
    const a = await salva(r, false);
    dice('primo Salva: nessuna domanda, scritto', [false, true, 'cat, a\tb,'], [a.chiesto, a.ok, f.testo]);
    const b = await salva(r, false);
    dice('secondo Salva senza cambi da fuori: nessuna domanda, scritto', [false, true, []], [b.chiesto, b.ok, r.notifiche.filter(([, tipo]) => tipo === 'error')]);
    f.testo = ESTERNO;
    const c = await salva(r, false);
    dice('...ma un cambio vero da fuori si vede ancora (si chiede, file intatto)', [true, false, ESTERNO], [c.chiesto, c.ok, f.testo]);
}
{
    const f = fileSulDisco('tags.json', JSON.stringify(['cat'], null, 2));
    const r = editor(f, ['cat'], ['cat', 'x\ty', 'a\u0001b']);
    const a = await salva(r, false);
    const b = await salva(r, false);
    dice('.json con tag con TAB e altri caratteri di controllo: due Salva di fila, nessuna domanda', [false, true, false, true], [a.chiesto, a.ok, b.chiesto, b.ok]);
}
{
    // ITALIANO: la galleria («Salva Modifiche») confronta gia' dopo la stessa pulizia dalle due parti.
    // ENGLISH: the gallery ("Save Changes") already compares after the same cleaning on both sides.
    dice('la galleria non ha lo stesso difetto: un .txt scritto con un TAB non risulta cambiato', false,
        S.txtCambiatoSulDisco('cat, a\tb,', ['cat', 'a\tb']));
}

console.log('\n--- i pulsanti e i testi della domanda ---');
{
    const blocco = sorgente.slice(sorgente.indexOf('{domandaSovrascrittura && ('));
    // ITALIANO: la domanda dell'editor ha un testo suo: quello del progetto parla de «il file .txt di
    //           questa foto» e de «la foto resta da salvare», falso per un .json o un .txt che non e' di una foto.
    // ENGLISH: the editor's question has its own string: the project one speaks of "this photo's .txt
    //          file" and "the photo stays unsaved", false for a .json or a .txt that belongs to no photo.
    dice('la domanda usa il titolo del progetto, Annulla e un testo suo (forma a funzione per il nome)', true,
        sorgente.includes('{domandaSovrascrittura && (') && /t\.saveTxtChangedTitle/.test(blocco) && /t\.tagEditorFileChangedAsk\.replace\('\{name\}', \(\) => /.test(blocco) && /t\.cancel/.test(blocco));
    dice('...e non piu\' il testo delle foto (saveTxtChangedAskOne)', false, /saveTxtChangedAskOne/.test(blocco));
    const domandaEn = typeof t.tagEditorFileChangedAsk === 'string' ? t.tagEditorFileChangedAsk.replace('{name}', () => 'progetto.json') : '';
    dice('en: per progetto.json la domanda nomina il file e non parla di una foto', [true, false], [domandaEn.includes('progetto.json'), /photo/i.test(domandaEn)]);
    for (const [lingua, tl] of Object.entries(lingue)) {
        dice(`${lingua}: saveTxtChangedTitle, e tagEditorFileChangedAsk con {name} una volta, diverso da saveTxtChangedAskOne`, true,
            typeof tl.saveTxtChangedTitle === 'string' && typeof tl.tagEditorFileChangedAsk === 'string'
            && tl.tagEditorFileChangedAsk.split('{name}').length === 2 && !tl.tagEditorFileChangedAsk.includes('{names}')
            && tl.tagEditorFileChangedAsk !== tl.saveTxtChangedAskOne);
    }
}

process.exit(esito());
