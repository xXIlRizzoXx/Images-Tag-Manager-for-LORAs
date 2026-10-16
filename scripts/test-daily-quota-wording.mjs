/* ITALIANO: PROVA DEL TESTO "QUOTA DEL GIORNO FINITA" PER CHI PAGA
   La quota del giorno si riconosce dal quotaId di Google ("...PerDay..."), che e' lo stesso per il
   piano gratuito ("-FreeTier") e per un account con la fatturazione attiva. Il messaggio pero'
   diceva "la quota GRATUITA di oggi" in tutte e nove le lingue: sbagliato per chi paga. La regola:
   il testo parla della quota di oggi, senza dire che e' gratuita.
   Uso:  node scripts/test-daily-quota-wording.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE "DAILY QUOTA USED UP" TEXT FOR A PAYING ACCOUNT
   The daily quota is recognised from Google's quotaId ("...PerDay..."), which is the same for the
   free tier ("-FreeTier") and for an account with billing on. The message however said "today's
   FREE quota" in all nine languages: wrong for a paying user. The rule: the text speaks of
   today's quota, without saying it is free.
   Usage:  node scripts/test-daily-quota-wording.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

const u = await esbuild.build({ entryPoints: [path.join(radice, 'src/constants.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const { translations } = await import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));

// ITALIANO: la parola "gratuito" in ogni lingua (radici, cosi' si prendono anche genere e caso).
// ENGLISH: the word "free" in every language (stems, so gender and case are caught too).
const GRATIS = {
    it: /gratuit/i, en: /\bfree\b/i, fr: /gratuit/i, es: /gratuit/i, de: /kostenlos|gratis/i,
    zh: /免费/, ja: /無料/, pt: /gr[aá]tis|gratuit/i, ru: /бесплатн/i,
};
for (const [lingua, parola] of Object.entries(GRATIS)) {
    const testo = translations[lingua] && translations[lingua].aiDailyQuota;
    dice(`${lingua}: il testo della quota del giorno esiste`, 'string', typeof testo);
    dice(`${lingua}: non dice "gratuita" (vale anche per chi paga)`, false, parola.test(String(testo)));
}

process.exit(esito());
