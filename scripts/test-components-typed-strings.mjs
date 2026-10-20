/* ITALIANO: PROVA: I COMPONENTI RICEVONO LE TRADUZIONI CON IL LORO TIPO, NON "any"
   Lightbox, TagFileEditor, TagSuggestionsPanel e le finestre di ui.tsx ricevevano `t` (i testi della
   lingua scelta) come `any`: il controllo dei tipi non vedeva una chiave scritta male o tolta da una
   lingua, e a schermo usciva un pulsante vuoto. Ora `t` ha il tipo di un blocco di src/constants.ts
   (Strings): una chiave che non c'e' ferma tsc.
   La prova controlla due cose: che ogni componente dichiari `t: Strings`, e che il compilatore se ne
   accorga davvero (una copia in memoria di Lightbox con una chiave inventata deve dare errore).
   Uso:  node scripts/test-components-typed-strings.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: THE COMPONENTS GET THE TRANSLATIONS WITH THEIR TYPE, NOT "any"
   Lightbox, TagFileEditor, TagSuggestionsPanel and the ui.tsx dialogs got `t` (the chosen language's
   texts) as `any`: the type check did not see a misspelled key or one removed from a language, and an
   empty button showed on screen. Now `t` has the type of a src/constants.ts block (Strings): a key that
   does not exist stops tsc.
   The test checks two things: that every component declares `t: Strings`, and that the compiler really
   notices (an in-memory copy of Lightbox with a made-up key must give an error).
   Usage:  node scripts/test-components-typed-strings.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const leggi = (rel) => fs.readFileSync(path.join(radice, rel), 'utf8');

// ITALIANO: 1. ogni componente che riceve `t` lo dichiara con il tipo Strings.
// ENGLISH: 1. every component receiving `t` declares it with the Strings type.
const componenti = [
    ['src/components/Lightbox.tsx', 'Lightbox'],
    ['src/components/TagFileEditor.tsx', 'TagFileEditor'],
    ['src/components/ui.tsx', 'ExportChoiceDialog'],
    ['src/components/ui.tsx', 'CustomConfirmDialog'],
    ['src/components/ui.tsx', 'SaveBeforeCloseDialog'],
    ['src/components/ui.tsx', 'ImportSummaryDialog'],
];
for (const [file, nome] of componenti) {
    const src = leggi(file);
    const i = src.indexOf(`export const ${nome} = (`);
    const firma = i >= 0 ? src.slice(i, src.indexOf('=>', i)) : '';
    dice(`${nome}: dichiara t: Strings`, true, /\bt:\s*Strings\b/.test(firma));
    dice(`${nome}: le props non sono tutte "any"`, false, /\}:\s*any\)\s*$/.test(firma.trim()));
}
const pannello = leggi('src/components/TagSuggestionsPanel.tsx');
dice('TagSuggestionsPanel: t: Strings nelle props', true, /\bt:\s*Strings;/.test(pannello));
for (const file of ['src/components/Lightbox.tsx', 'src/components/TagFileEditor.tsx', 'src/components/ui.tsx', 'src/components/TagSuggestionsPanel.tsx']) {
    dice(`${path.basename(file)}: nessun "t: any" rimasto`, false, /\bt\??:\s*any\b/.test(leggi(file)));
}
dice('App.tsx: AnteprimaNonDisponibile dichiara t: Strings', true, /const AnteprimaNonDisponibile = \(\{[^}]*\}: \{ t: Strings;/.test(leggi('src/App.tsx')));
dice('constants.ts esporta il tipo Strings', true, /export type Strings = typeof translations\.en;/.test(leggi('src/constants.ts')));

// ITALIANO: 2. il compilatore si accorge di una chiave inventata usata in un componente.
// ENGLISH: 2. the compiler notices a made-up key used in a component.
const require = createRequire(import.meta.url);
const ts = require(path.join(radice, 'node_modules/typescript'));
const config = ts.parseJsonConfigFileContent(ts.readConfigFile(path.join(radice, 'tsconfig.json'), ts.sys.readFile).config, ts.sys, radice);
const finto = path.join(radice, 'src/components/Lightbox.tsx');
const originale = leggi('src/components/Lightbox.tsx');
const conErrore = originale.replace('{t.', '{t.chiaveCheNonEsisteAffatto || t.');
const host = ts.createCompilerHost(config.options);
const leggiOriginale = host.readFile.bind(host);
host.readFile = (f) => (path.resolve(f) === path.resolve(finto) ? conErrore : leggiOriginale(f));
const prog = ts.createProgram({ rootNames: [finto], options: { ...config.options, noEmit: true }, host });
const errori = ts.getPreEmitDiagnostics(prog).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
dice('premessa: la copia contiene davvero la chiave inventata', true, conErrore !== originale);
dice('tsc segnala la chiave inventata in Lightbox', true, errori.some(m => m.includes('chiaveCheNonEsisteAffatto')));

process.exit(esito());
