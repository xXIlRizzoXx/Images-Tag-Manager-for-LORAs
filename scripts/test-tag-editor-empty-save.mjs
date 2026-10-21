/* ITALIANO: PROVA DI "SALVA E CHIUDI" DELL'EDITOR DEI FILE DI TAG CON LA LISTA VUOTA
   Nell'editor dei file di tag, togliendo con la X tutti i tag di un .txt, Salva e Salva come si
   spengono: l'editor non scrive un elenco vuoto. Ma "Chiudi file" -> "Salva e chiudi" restava
   acceso e scriveva un .txt VUOTO sopra quello della foto, con l'avviso verde "File salvato" e
   senza l'avviso che Kohya si ferma su un .txt vuoto; la foto in galleria passava a nessun tag.
   Ora "Salva e chiudi" si spegne come Salva, e il salvataggio stesso non scrive mai un elenco vuoto.
   Si eseguono i testi VERI di salva e salvaEChiudiFile presi da src/components/TagFileEditor.tsx
   (compilati con esbuild) con un file finto, e si leggono i pulsanti veri.
   Uso:  node scripts/test-tag-editor-empty-save.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE TAG FILE EDITOR'S "SAVE AND CLOSE" WITH AN EMPTY LIST
   In the tag file editor, removing every tag of a .txt with the X turns Save and Save as off: the
   editor does not write an empty list. But "Close file" -> "Save and close" stayed on and wrote an
   EMPTY .txt over the photo's one, with the green "File saved" notice and without the warning that
   Kohya stops on an empty .txt; the photo in the gallery went to no tags.
   Now "Save and close" turns off like Save, and saving itself never writes an empty list.
   The REAL texts of salva and salvaEChiudiFile taken from src/components/TagFileEditor.tsx are run
   (compiled with esbuild) with a fake file, and the real buttons are read.
   Usage:  node scripts/test-tag-editor-empty-save.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const sorgente = fs.readFileSync(path.join(radice, 'src/components/TagFileEditor.tsx'), 'utf8');

const ritaglia = async (intestazione, chiusura) => {
    const inizio = sorgente.indexOf(intestazione);
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (inizio < 0 || !fine) {
        console.log('NO  non trovato in src/components/TagFileEditor.tsx: ' + intestazione.trim());
        process.exit(1);
    }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length).replace(/^export /, ''), { loader: 'ts' })).code;
};
const testo = (await ritaglia('export const serializeTagFile = (', /\r?\n\};\r?\n/g)) + '\n' +
    (await ritaglia('    const salvaEChiudiFile = async () => {', /\r?\n    \};\r?\n/g)) + '\n' +
    (await ritaglia('    const salva = async (forzaNuovoFile = false): Promise<boolean> => {', /\r?\n    \};\r?\n/g));
const fabbrica = new Function('tags', 'fileName', 'rileggendo', 'handleRef', 'triggersRef', 'savedTagsRef', 'tagsRef', 'setDirty', 'setFileName',
    'setChiusuraFile', 'azzera', 'soundManager', 'showNotification', 't', 'onFileSaved', 'window', 'document', 'URL', 'Blob',
    'inAttesa', 'setTags', 'setInputValue', 'uniqueTagsIgnoringCase', 'hasTagIgnoringCase',
    testo + '\nreturn { salva, salvaEChiudiFile };');

const t = { tagEditorSaved: 'File saved', tagEditorSaveError: 'Could not save', tagEditorDownloaded: 'A copy was downloaded ({name}).' };
// ITALIANO: `attesa` = il testo scritto nella casella e non confermato con Invio; `conSelettore` = il
//           browser sa aprire la finestra di salvataggio (senza, l'editor ripiega su un download).
// ENGLISH: `attesa` = the text typed in the box and not confirmed with Enter; `conSelettore` = the
//          browser can open the save dialog (without it the editor falls back to a download).
const editor = (tags, { attesa = [], conSelettore = true } = {}) => {
    const r = { scritture: [], notifiche: [], sincronizzati: [], chiuso: false, aperturaSalvataggio: 0 };
    const handle = {
        name: 'img_001.txt',
        async createWritable() { return { async write(c) { r.scritture.push(c); }, async close() { } }; },
    };
    const finestra = conSelettore ? { async showSaveFilePicker() { r.aperturaSalvataggio++; return handle; } } : {};
    const documento = { createElement: () => ({ click() { r.scaricato = true; } }), body: { appendChild() { }, removeChild() { } } };
    const conHandle = (h) => fabbrica(tags, 'img_001.txt', false, { current: h }, { current: [] }, { current: ['smile'] }, { current: tags },
        () => { }, () => { }, () => { }, () => { r.chiuso = true; }, { chime() { }, pop() { } }, (m, tipo) => r.notifiche.push([m, tipo]), t,
        (nome, lista) => r.sincronizzati.push([nome, lista]), finestra, documento, URL, Blob,
        () => [...attesa], (v) => { r.tagMostrati = v; }, (v) => { r.casella = v; }, (l) => [...new Set(l)], (l, x) => l.includes(x));
    r.fn = conHandle(handle);
    r.fnSenzaFile = conHandle(null);
    return r;
};

console.log('\n--- "Chiudi file" -> "Salva e chiudi" con tutti i tag tolti ---');
{
    const r = editor([]);
    await r.fn.salvaEChiudiFile();
    dice('nessun .txt vuoto scritto sopra quello della foto', [], r.scritture);
    dice('nessun avviso verde "File salvato"', [], r.notifiche.filter(([, tipo]) => tipo === 'success'));
    dice('la foto in galleria non passa a nessun tag', [], r.sincronizzati);
    dice('il file resta aperto (non si chiude come se fosse salvato)', false, r.chiuso);
    const n = editor([]);
    await n.fnSenzaFile.salvaEChiudiFile();
    dice('editor senza file: nessuna finestra per creare un tags.txt vuoto', 0, n.aperturaSalvataggio);
    dice('...e niente scritto', [], n.scritture);
}

console.log('\n--- i pulsanti: "Salva e chiudi" spento con la lista vuota, come Salva e Salva come ---');
{
    const pulsanti = [...sorgente.matchAll(/<button onClick=\{([^}]*(?:\{[^}]*\})?[^}]*)\} disabled=\{([^}]*)\}/g)]
        .map(m => ({ azione: m[1].trim(), spento: m[2] }))
        .filter(p => /\bsalva(EChiudiFile)?\b/.test(p.azione));
    dice('si trovano Salva, Salva come e Salva e chiudi', 3, pulsanti.length);
    for (const p of pulsanti) dice(`"${p.azione}": spento con la lista vuota`, true, /tags\.length === 0/.test(p.spento));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = editor(['smile', 'blue eyes']);
    await r.fn.salvaEChiudiFile();
    dice('con dei tag "Salva e chiudi" scrive il file', ['smile, blue eyes,'], r.scritture);
    dice('...con l\'avviso verde', [['File saved: img_001.txt', 'success']], r.notifiche);
    dice('...allinea la foto e chiude il file', [[['img_001.txt', ['smile', 'blue eyes']]], true], [r.sincronizzati, r.chiuso]);
    const s = editor(['1girl']);
    dice('Salva con dei tag restituisce "scritto"', true, await s.fn.salva(false));
    dice('...e scrive', ['1girl,'], s.scritture);
}

console.log('\n--- il testo scritto e non confermato con Invio ---');
{
    const r = editor(['smile'], { attesa: ['blue eyes'] });
    await r.fn.salvaEChiudiFile();
    dice('"Salva e chiudi" lo scrive insieme agli altri tag', ['smile, blue eyes,'], r.scritture);
    dice('...lo mostra fra i tag e svuota la casella', [['smile', 'blue eyes'], ''], [r.tagMostrati, r.casella]);
    const v = editor([], { attesa: ['1girl'] });
    dice('con la lista vuota ma del testo in attesa, Salva scrive il file', true, await v.fn.salva(false));
    dice('...con quel tag', ['1girl,'], v.scritture);
    const ed = fs.readFileSync(path.join(radice, 'src/components/TagFileEditor.tsx'), 'utf8');
    dice('chiudere, aprire o "Nuovo" chiedono prima anche per il solo testo in attesa', true,
        /const modificato = dirty \|\| inAttesa\(\)\.length > 0;[\s\S]{0,80}const guardDiscard = [^\n]*\n\s*if \(!modificato\)/.test(ed));
}

console.log('\n--- un browser senza finestra di salvataggio: il download non e\' un salvataggio ---');
{
    const r = editor(['smile'], { conSelettore: false });
    const scritto = await r.fnSenzaFile.salva(false);
    dice('scarica una copia', true, r.scaricato === true);
    dice('ma non dice "Salvato" e non torna "scritto"', [false, []], [scritto, r.notifiche.filter(([, tipo]) => tipo === 'success')]);
    dice('dice che e\' una copia scaricata', [['A copy was downloaded (img_001.txt).', 'info']], r.notifiche);
}

process.exit(esito());
