/* ITALIANO: PROVA DI CONTRIBUTING.md CONTRO I CONTROLLI VERI DEL PROGETTO
   La guida per chi contribuisce diceva che l'oggetto delle traduzioni e' tipizzato, quindi una
   chiave mancante e' un errore di compilazione, e come unico controllo nominava `npm run lint`.
   Non e' cosi' per le scritte lette dentro i componenti: li' le traduzioni arrivano senza tipo,
   una chiave dimenticata in una lingua passa il controllo dei tipi e compare vuota. Chi la
   prende in fallo e' scripts/check-translations.mjs, che la guida non nominava, come non
   nominava le prove automatiche. La regola: finche' qualche componente riceve le traduzioni
   senza tipo, la guida non promette l'errore di compilazione e nomina i due controlli veri.
   Uso:  node scripts/test-contributing-doc.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF CONTRIBUTING.md AGAINST THE PROJECT'S REAL CHECKS
   The contributor guide said the translation object is typed, so a missing key is a compile
   error, and named `npm run lint` as the only check. That is not true for strings read inside the
   components: there the translations arrive untyped, a key forgotten in one language passes the
   type check and shows up blank. What catches it is scripts/check-translations.mjs, which the
   guide did not name, nor did it name the automated tests. The rule: while some component gets
   the translations untyped, the guide does not promise a compile error and names the two real
   checks.
   Usage:  node scripts/test-contributing-doc.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const leggi = (f) => fs.readFileSync(path.join(radice, f), 'utf8');

const guida = leggi('CONTRIBUTING.md');

// ITALIANO: i componenti che ricevono `t` senza tipo (props `: any`, `t: any`, `as any`).
// ENGLISH: the components that receive `t` untyped (props `: any`, `t: any`, `as any`).
const cartella = path.join(radice, 'src/components');
const senzaTipo = fs.readdirSync(cartella).filter(f => /\.tsx$/.test(f)).filter(f => {
    const s = fs.readFileSync(path.join(cartella, f), 'utf8');
    return /\bt\s*:\s*any\b/.test(s) || /\{[^}]*\bt\b[^}]*\}\s*:\s*any\b/.test(s) || /\(translations as any\)/.test(s);
});
console.log(`Componenti con le traduzioni senza tipo: ${senzaTipo.join(', ') || 'nessuno'}`);

if (senzaTipo.length > 0) {
    dice('non promette piu\' che una chiave mancante sia un errore di compilazione', false, /missing key is a compile error/i.test(guida));
}
dice('nomina il controllo delle nove lingue', true, guida.includes('node scripts/check-translations.mjs'));
dice('nomina le prove automatiche', true, guida.includes('node scripts/run-tests.mjs'));

process.exit(esito());
