/* ITALIANO: PROVA DEGLI STRUMENTI MCP DAL LATO DELLA FINESTRA (src/utils/mcpBridge.ts)
   Il codice VERO compilato con esbuild, con un programma finto: foto in memoria, trigger word e
   una funzione "applica" che annota cosa verrebbe cambiato. Controlla le regole di sempre (trigger
   prima e mai tolte, ordine alfabetico, maiuscole unite, virgola che divide i tag), che le foto nel
   cestino non si vedano e non si tocchino, e che in App.tsx le modifiche aggiornino SUBITO la
   memoria letta dalle domande successive e arrivi l'avviso "non ancora salvati".
   Uso:  node scripts/test-mcp-bridge.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE MCP TOOLS ON THE WINDOW'S SIDE (src/utils/mcpBridge.ts)
   The REAL code compiled with esbuild, with a fake program: photos in memory, trigger words and an
   "applica" function recording what would change. Checks the usual rules (triggers first and
   never removed, alphabetical order, case merged, a comma splitting tags), that trashed photos are
   neither seen nor touched, and that in App.tsx changes update AT ONCE the memory read by the
   following questions and the "not saved yet" notice shows.
   Usage:  node scripts/test-mcp-bridge.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
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
    const stato = { foto: foto.map(f => ({ ...f })), applicati: [] };
    return {
        stato,
        ctx: {
            foto: () => stato.foto,
            trigger: () => trigger,
            applica: (nuovi) => {
                stato.applicati.push(Object.fromEntries(nuovi));
                stato.foto = stato.foto.map(f => (nuovi.has(f.id) ? { ...f, tags: nuovi.get(f.id) } : f));
            },
            immagine: async (id) => (id === 'tif' ? null : { data: 'QUJD', mimeType: 'image/jpeg' }),
        },
    };
};
const FOTO = [
    { id: 'a', file: { name: 'a.png' }, tags: ['ohwx', 'smile', 'red dress'], originalTags: ['ohwx', 'smile', 'red dress'], cartellaImport: 'set', cartellaRel: '' },
    { id: 'b', file: { name: 'b.png' }, tags: ['ohwx', 'Smile'], originalTags: ['ohwx'], cartellaImport: 'set', cartellaRel: '10_face' },
    { id: 'c', file: { name: 'c.png' }, tags: ['ohwx'], originalTags: ['ohwx'], cartellaImport: 'set', cartellaRel: '' },
    { id: 'x', file: { name: 'cestinata.png' }, tags: ['smile'], originalTags: ['smile'], isTrashed: true },
    { id: 'tif', file: { name: 'foto.tif' }, tags: [], originalTags: [] },
];
const T = ['ohwx'];

console.log('\n--- leggere ---');
{
    const { ctx } = programma(FOTO, T);
    const r = (await B.eseguiStrumentoMcp('list_photos', {}, ctx)).risultato;
    dice('le foto nel cestino non si vedono', ['a', 'b', 'c', 'tif'], r.photos.map(p => p.id));
    dice('nome, cartella e "non salvata" giusti', { name: 'b.png', folder: 'set/10_face', unsaved: true }, (({ name, folder, unsaved }) => ({ name, folder, unsaved }))(r.photos[1]));
    const s = (await B.eseguiStrumentoMcp('list_photos', { tags: ['SMILE'] }, ctx)).risultato;
    dice('filtro per tag senza badare alle maiuscole', ['a', 'b'], s.photos.map(p => p.id));
    const u = (await B.eseguiStrumentoMcp('list_photos', { untagged_only: true }, ctx)).risultato;
    dice('"senza tag" conta anche chi ha solo la trigger word', ['c', 'tif'], u.photos.map(p => p.id));
    const p = (await B.eseguiStrumentoMcp('list_photos', { offset: 1, limit: 2 }, ctx)).risultato;
    dice('offset e limit', [4, ['b', 'c']], [p.total, p.photos.map(x => x.id)]);
    const c = (await B.eseguiStrumentoMcp('list_project_tags', {}, ctx)).risultato;
    dice('conteggi dei tag (cestinate escluse)', [{ tag: 'ohwx', count: 3 }, { tag: 'red dress', count: 1 }, { tag: 'smile', count: 1 }, { tag: 'Smile', count: 1 }], c.tags);
    const g = await B.eseguiStrumentoMcp('get_photo', { id: 'a' }, ctx);
    dice('get_photo: immagine e tag', [{ data: 'QUJD', mimeType: 'image/jpeg' }, ['ohwx', 'smile', 'red dress']], [g.immagine, g.info.tags]);
    dice('get_photo di un formato illeggibile: errore che lo spiega', true, /cannot be shown/.test((await B.eseguiStrumentoMcp('get_photo', { id: 'tif' }, ctx)).errore || ''));
    dice('get_photo di una foto nel cestino: non esiste', true, /No open photo/.test((await B.eseguiStrumentoMcp('get_photo', { id: 'x' }, ctx)).errore || ''));
    dice('strumento sconosciuto: errore', true, /Unknown tool/.test((await B.eseguiStrumentoMcp('save_all', {}, ctx)).errore || ''));
}

console.log('\n--- cambiare ---');
{
    const { ctx, stato } = programma(FOTO, T);
    const r = await B.eseguiStrumentoMcp('set_tags', { id: 'a', tags: ['blue eyes', 'Smile', 'smile', 'long hair, standing'] }, ctx);
    dice('set_tags: trigger tenuta e prima, maiuscole unite, virgola divide, ordine alfabetico',
        ['ohwx', 'blue eyes', 'long hair', 'Smile', 'standing'], stato.foto.find(f => f.id === 'a').tags);
    dice('...e dice che non e\' salvato', [1, true], [r.cambiate, /Save Changes/.test(r.risultato.note)]);
    const r2 = await B.eseguiStrumentoMcp('add_tags', { ids: ['b', 'c', 'x', 'nessuna'], tags: ['portrait', 'smile'] }, ctx);
    dice('add_tags: la cestinata e l\'id inesistente non si toccano e si dicono', [2, ['x', 'nessuna']], [r2.cambiate, r2.risultato.not_found]);
    dice('...e "Smile" gia\' presente non diventa un secondo tag', ['ohwx', 'portrait', 'Smile'], stato.foto.find(f => f.id === 'b').tags);
    dice('...la cestinata resta com\'era', ['smile'], stato.foto.find(f => f.id === 'x').tags);
    const r3 = await B.eseguiStrumentoMcp('remove_tags', { ids: ['b'], tags: ['OHWX', 'smile'] }, ctx);
    dice('remove_tags: la trigger word non si toglie e lo si dice', [['ohwx', 'portrait'], ['ohwx']], [stato.foto.find(f => f.id === 'b').tags, r3.risultato.trigger_words_kept]);
    const prima = stato.applicati.length;
    const r4 = await B.eseguiStrumentoMcp('add_tags', { ids: ['c'], tags: ['portrait'] }, ctx);
    dice('niente da cambiare: nessuna modifica (nessun passo vuoto nella cronologia)', [0, prima], [r4.cambiate, stato.applicati.length]);
    dice('set_tags con un tag lungo: tagliato a 4000 caratteri, come i .txt', [300, 4000], [B.pulisciTag(['x'.repeat(300)])[0].length, B.pulisciTag(['x'.repeat(5000)])[0].length]);
    dice('tag vuoti o di soli spazi: scartati', ['a'], B.pulisciTag(['  ', '', ' a ', null]));
    dice('add_tags senza tag: errore', true, /No tag/.test((await B.eseguiStrumentoMcp('add_tags', { ids: ['a'], tags: [] }, ctx)).errore || ''));
}

console.log('\n--- in App.tsx ---');
{
    const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
    dice('le modifiche aggiornano SUBITO la memoria letta dalle domande seguenti', true, /applica: \(nuovi\) => \{\s*(const tagPrima = [^;\n]*;\s*)?imagesRef\.current = imagesRef\.current\.map/.test(app));
    dice('...e passano da setImages (cronologia e "da salvare")', true, /applica: \(nuovi\) => \{[\s\S]{0,400}setImages\(prev => prev\.map/.test(app));
    // ITALIANO: il numero e l'errore a schermo li prova test-mcp-notice-total.mjs. ENGLISH: the count and the on-screen error are tested by test-mcp-notice-total.mjs.
    dice('dopo una modifica arriva l\'avviso "non ancora salvati"', true,
        /if \(risposta\.cambiate\) mcpAvvisoRef\.current\(\);/.test(app) && /mcpAvvisoRef\.current = \(\) => \{[\s\S]{0,3000}t\.mcpEditedNotice\.replace/.test(app));
    dice('la risposta torna sempre al server, anche se qualcosa va storto', true, /catch \(e\) \{[\s\S]{0,200}risposta = \{ errore:[\s\S]{0,100}\}\s*(\/\/[^\n]*\n\s*)*(try \{ )?window\.electronAPI\?\.mcp\?\.respond\(r\.id, risposta\)/.test(app));
    const ponte = fs.readFileSync(path.join(radice, 'src/utils/mcpBridge.ts'), 'utf8');
    dice('la foto per l\'AI si ridisegna (niente metadati, niente file originale)', true, /drawImage\(bitmap/.test(ponte) && /toBlob\(fatto, 'image\/jpeg'/.test(ponte));
}

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
