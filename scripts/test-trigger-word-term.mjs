/* ITALIANO: PROVA DEL NOME "TRIGGER WORDS" IN FRANCESE E SPAGNOLO
   Chi addestra LoRA conosce le "trigger words" con questo nome (Kohya, Civitai): l'italiano lo usa
   gia'. Francese e spagnolo lo traducevano ("mots déclencheurs", "palabras desencadenantes") in tre
   frasi. Decisione del 16/10/2026: anche loro scrivono "trigger words".
   Uso:  node scripts/test-trigger-word-term.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE NAME "TRIGGER WORDS" IN FRENCH AND SPANISH
   LoRA trainers know "trigger words" by this name (Kohya, Civitai): Italian already uses it.
   French and Spanish translated it in three sentences. Owner's decision of 16/10/2026: they write
   "trigger words" too. */

import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const lingue = (await import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'))).translations;

const CHIAVI = ['globalTriggersPlaceholder', 'confirmDeleteAllTagsMsg', 'aiSkipTaggedHint'];
for (const l of ['fr', 'es']) {
    const testi = Object.values(lingue[l]).filter(v => typeof v === 'string');
    dice(`${l}: nessuna frase traduce "trigger word"`, [], testi.filter(v => /d[ée]clencheur|desencadenante/i.test(v)));
    dice(`${l}: le tre frasi dicono "trigger words"`, CHIAVI.map(() => true), CHIAVI.map(k => /trigger words/i.test(lingue[l][k] || '')));
}

process.exit(esito());
