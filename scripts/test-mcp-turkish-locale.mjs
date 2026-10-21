/* ITALIANO: PROVA: GLI STRUMENTI MCP NON BADANO ALLE MAIUSCOLE ANCHE CON WINDOWS IN TURCO
   remove_tags e il filtro "tags" di list_photos promettono di non badare alle maiuscole. Prima
   usavano toLocaleLowerCase(), che segue la lingua del sistema: in turco (e azero) la I maiuscola
   diventa una i senza punto, quindi "Indoor" non era "indoor" (remove_tags non toglieva, il filtro
   non trovava), mentre add_tags univa i due tag. Qui la lingua predefinita si finge turca
   sostituendo String.prototype.toLocaleLowerCase (senza argomento usa 'tr'), come fa Chromium su
   un Windows in turco, e si rimette l'originale alla fine.
   Uso:  node scripts/test-mcp-turkish-locale.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: THE MCP TOOLS IGNORE CASE ALSO WITH WINDOWS IN TURKISH
   remove_tags and the "tags" filter of list_photos promise to ignore case. They used
   toLocaleLowerCase(), which follows the system language: in Turkish (and Azeri) the capital I
   becomes a dotless i, so "Indoor" was not "indoor" (remove_tags did not remove, the filter did
   not find), while add_tags merged the two tags. Here the default locale is faked as Turkish by
   replacing String.prototype.toLocaleLowerCase (no argument -> 'tr'), as Chromium does on a
   Turkish Windows, and the original is put back at the end.
   Usage:  node scripts/test-mcp-turkish-locale.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/mcpBridge.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const B = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));

let guai = 0, fatti = 0;
const dice = (nome, atteso, avuto) => {
    fatti++;
    const ok = JSON.stringify(atteso) === JSON.stringify(avuto);
    if (!ok) guai++;
    console.log(`${ok ? 'OK ' : 'NO '} ${nome}${ok ? '' : `\n     atteso: ${JSON.stringify(atteso)}\n     avuto:  ${JSON.stringify(avuto)}`}`);
};

const programma = (foto, trigger = []) => {
    const stato = { foto: foto.map(f => ({ ...f })) };
    return {
        stato,
        ctx: {
            foto: () => stato.foto,
            trigger: () => trigger,
            applica: (nuovi) => { stato.foto = stato.foto.map(f => (nuovi.has(f.id) ? { ...f, tags: nuovi.get(f.id) } : f)); },
            immagine: async () => null,
        },
    };
};
const FOTO = [
    { id: 'a', file: { name: 'a.png' }, tags: ['Indoor', 'smile'], originalTags: ['Indoor', 'smile'] },
    { id: 'b', file: { name: 'b.png' }, tags: ['outdoor'], originalTags: ['outdoor'] },
];

const originale = String.prototype.toLocaleLowerCase;
// ITALIANO: la finta lingua di sistema turca. ENGLISH: the fake Turkish system locale.
String.prototype.toLocaleLowerCase = function (lingua) { return originale.call(this, lingua ?? 'tr'); };
try {
    dice('la finta lingua turca e\' attiva (Indoor -> ındoor)', 'ındoor', 'Indoor'.toLocaleLowerCase());
    {
        const { ctx } = programma(FOTO);
        const r = (await B.eseguiStrumentoMcp('list_photos', { tags: ['indoor'] }, ctx)).risultato;
        dice('list_photos con tags ["indoor"] trova la foto con "Indoor"', [1, ['a']], [r.total, r.photos.map(p => p.id)]);
        const r2 = (await B.eseguiStrumentoMcp('list_photos', { tags: ['INDOOR'] }, ctx)).risultato;
        dice('...e anche con "INDOOR"', [1, ['a']], [r2.total, r2.photos.map(p => p.id)]);
    }
    {
        const { ctx, stato } = programma(FOTO);
        const r = await B.eseguiStrumentoMcp('remove_tags', { ids: ['a'], tags: ['indoor'] }, ctx);
        dice('remove_tags ["indoor"] toglie "Indoor"', [1, ['smile']], [r.risultato.changed, stato.foto.find(f => f.id === 'a').tags]);
    }
    {
        const { ctx, stato } = programma(FOTO);
        const r = await B.eseguiStrumentoMcp('add_tags', { ids: ['a'], tags: ['indoor'] }, ctx);
        dice('add_tags "indoor" resta unito a "Indoor" (come prima)', [0, ['Indoor', 'smile']], [r.risultato.changed, stato.foto.find(f => f.id === 'a').tags]);
    }
    {
        // ITALIANO: caso vicino: un tag con la i minuscola e uno con la I maiuscola nella richiesta.
        // ENGLISH: neighbouring case: a lower-case i tag and an upper-case I in the request.
        const { ctx, stato } = programma([{ id: 'c', file: { name: 'c.png' }, tags: ['illustration', 'smile'], originalTags: [] }]);
        const r = await B.eseguiStrumentoMcp('remove_tags', { ids: ['c'], tags: ['Illustration'] }, ctx);
        dice('remove_tags ["Illustration"] toglie "illustration"', [1, ['smile']], [r.risultato.changed, stato.foto.find(f => f.id === 'c').tags]);
    }
} finally {
    String.prototype.toLocaleLowerCase = originale;
}
dice('la lingua finta e\' tolta alla fine', 'indoor', 'Indoor'.toLocaleLowerCase('en'));

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
