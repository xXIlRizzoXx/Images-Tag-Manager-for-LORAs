/* ITALIANO: PROVA DELLA FOTO RITOCCATA E DEI MOTIVI PER CUI UNA FOTO NON PARTE
   Il File preso all'importazione e' un'istantanea: se dopo la foto viene ritoccata in un altro
   programma, Chromium rifiuta di leggerlo (NotReadableError). Fino alla 2.0.0 la taggatura AI
   mandava sempre quell'istantanea: la foto ritoccata non si taggava mai, e il messaggio diceva che
   era stata spostata o cancellata. Qui si controlla che:
   - una foto aperta con una cartella venga riletta dalla sua cartella e parta (una e in blocco);
   - una foto senza cartella che non si legge piu' dica proprio questo (aiPhotoUnreadable);
   - una foto con dati nascosti che non si sanno togliere dica questo (aiPhotoHiddenData), e il
     riepilogo della taggatura in blocco conti quante sono (aiBatchHiddenData).
   Gira SENZA rete e SENZA chiave: i pezzi VERI di src/App.tsx (handleAITagSingle, handleAITagAll)
   con il servizio vero e un Google finto che registra i byte mandati.
   Uso:  node scripts/test-ai-retouched-photo.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE RETOUCHED PHOTO AND OF THE REASONS A PHOTO IS NOT SENT
   The File taken at import is a snapshot: if the photo is later retouched in another program,
   Chromium refuses to read it (NotReadableError). Up to 2.0.0 AI tagging always sent that snapshot:
   the retouched photo was never tagged, and the message said it had been moved or deleted. This
   checks that a photo opened with a folder is re-read from its folder and sent (single and bulk);
   that a photo with no folder that can no longer be read says exactly that; and that a photo whose
   hidden data cannot be removed says that, with the bulk summary counting how many.
   Runs WITHOUT network and WITHOUT a key. */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let guai = 0, fatti = 0;
const dice = (cosa, ok, dettaglio = '') => {
    fatti++;
    if (!ok) guai++;
    console.log('  ' + (ok ? 'OK  ' : 'NO  ') + cosa + (ok || !dettaglio ? '' : '\n        ' + dettaglio));
};
const muto = { log() { }, warn() { }, error() { } };

const finto = {
    name: 'google-finto',
    setup(b) {
        b.onResolve({ filter: /^@google\/genai$/ }, () => ({ path: 'finto', namespace: 'finto' }));
        b.onLoad({ filter: /.*/, namespace: 'finto' }, () => ({
            contents: `
                export const Type = { ARRAY: 'ARRAY', STRING: 'STRING' };
                export class GoogleGenAI {
                    constructor() {}
                    get models() {
                        return {
                            list: async () => ({ async *[Symbol.asyncIterator]() { } }),
                            generateContent: async (req) => { globalThis.__RICHIESTE__.push(req); return { text: '["cat", "sofa"]' }; },
                        };
                    }
                }`,
            loader: 'js',
        }));
    },
};
const carica = async (rel, plugins = []) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, plugins, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const S = await carica('src/services/geminiService.ts', [finto]);
const C = await carica('src/utils/tagCase.ts');
const t = (await carica('src/constants.ts')).translations.en;

// ITALIANO: come il FileReader vero: il data URL dei byte che riceve (cosi' si vede COSA parte).
// ENGLISH: like the real FileReader: the data URL of the bytes it receives (so WHAT is sent shows).
globalThis.FileReader = class {
    readAsDataURL(blob) {
        blob.arrayBuffer().then(ab => {
            this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(ab).toString('base64');
            this.onloadend && this.onloadend();
        }, e => { this.error = e; this.onerror && this.onerror(); });
    }
};

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const prendi = async (inizioTesto, fineRegex, nome) => {
    const inizio = sorgente.indexOf(inizioTesto);
    fineRegex.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : fineRegex.exec(sorgente);
    if (!fine) { console.log(`NO  ${nome} non trovato in src/App.tsx`); process.exit(1); }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
};
const codiceUna = await prendi('    const handleAITagSingle = useCallback(', /\r?\n    \}, \[[^\]]*\]\);\r?\n/g, 'handleAITagSingle');
const codiceTutte = await prendi('    const handleAITagAll = useCallback(', /\r?\n    \}, \[[^\]]*\]\);\r?\n/g, 'handleAITagAll');
const DIP = ['aiEnabled', 'geminiApiKey', 'aiModel', 'aiMaxTags', 'aiCustomPrompt', 'aiRpm', 'aiSkipTagged', 'images',
    'imagesRef', 'isGlobalAITagging', 't', 'updateImageTags', 'getGeminiTags', 'classifyGeminiError', 'showNotification',
    'soundManager', 'setRiparaModello', 'setIsApiKeyDialogOpen', 'setIsAIBusy', 'aiCancelRequestedRef', 'setAiCancelRequested',
    'aiAbortControllerRef', 'setIsGlobalAITagging', 'setGlobalAIProgress', 'countNewTagsIgnoringCase', 'hasTagsBeyondTriggers',
    'globalTriggersRef', 'txtNonLettoInVigore', 'useCallback', 'Date', 'setTimeout', 'console', 'progettoGenRef', 'geminiApiKeyRef',
    'aiEnabledRef', 'aiSingolaControllerRef'];
const fabbricaUna = new Function(...DIP, codiceUna + '\nreturn handleAITagSingle;');
const fabbricaTutte = new Function(...DIP, codiceTutte + '\nreturn handleAITagAll;');

// ITALIANO: due PNG minimi diversi: l'istantanea dell'import e la foto ritoccata di adesso.
// ENGLISH: two different minimal PNGs: the import snapshot and today's retouched photo.
const png = (segno) => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 1, 73, 68, 65, 84, segno, 0, 0, 0, 0, 0, 0, 0, 0, 73, 69, 78, 68, 0xAE, 0x42, 0x60, 0x82]);
// ITALIANO: l'istantanea di una foto cambiata su disco: Chromium la rifiuta come qui.
// ENGLISH: the snapshot of a photo changed on disk: Chromium refuses it as here.
class Istantanea extends File {
    arrayBuffer() { return Promise.reject(Object.assign(new Error('The requested file could not be read'), { name: 'NotReadableError' })); }
}
const cartellaCon = (nome, bytes) => ({ getFileHandle: async (n) => {
    if (n !== nome) throw Object.assign(new Error('not found'), { name: 'NotFoundError' });
    return { getFile: async () => new File([bytes], nome, { type: 'image/png' }) };
} });

const nuovaApp = (foto, getGeminiTags = S.getGeminiTags) => {
    globalThis.__RICHIESTE__ = [];
    const app = { notifiche: [], foto };
    let orologio = 1_000_000;
    const dip = {
        aiEnabled: true, geminiApiKey: 'AIza' + 'x'.repeat(35), aiModel: 'gemini-3.8-flash', aiMaxTags: 30, aiCustomPrompt: '',
        aiRpm: 14, aiSkipTagged: false, images: foto, imagesRef: { current: foto }, isGlobalAITagging: false, t,
        updateImageTags: (id, tags) => { const f = foto.find(x => x.id === id); if (f) f.tags = tags; },
        getGeminiTags, classifyGeminiError: S.classifyGeminiError,
        showNotification: (m, tipo) => app.notifiche.push([m, tipo]),
        soundManager: { chime() { } }, setRiparaModello: () => { }, setIsApiKeyDialogOpen: () => { }, setIsAIBusy: () => { },
        aiCancelRequestedRef: { current: false }, setAiCancelRequested: () => { },
        aiAbortControllerRef: { current: null }, setIsGlobalAITagging: () => { }, setGlobalAIProgress: () => { },
        countNewTagsIgnoringCase: C.countNewTagsIgnoringCase, hasTagsBeyondTriggers: C.hasTagsBeyondTriggers,
        globalTriggersRef: { current: [] }, txtNonLettoInVigore: () => false,
        useCallback: (f) => f,
        Date: { now: () => orologio },
        setTimeout: (f, ms) => { orologio += Math.max(0, ms || 0); queueMicrotask(f); return 0; },
        console: muto,
        progettoGenRef: { current: 0 },
        geminiApiKeyRef: { current: 'AIza' + 'x'.repeat(35) },
        aiEnabledRef: { current: true }, aiSingolaControllerRef: { current: null },
    };
    const args = DIP.map(n => dip[n]);
    app.una = (id) => fabbricaUna(...args)(id);
    app.tutte = () => fabbricaTutte(...args)();
    app.mandati = () => globalThis.__RICHIESTE__.map(r => Buffer.from(r.contents.parts[0].inlineData.data, 'base64'));
    return app;
};
const fotoRitoccata = (id) => {
    const nome = id + '.png';
    return { id, isTrashed: false, tags: [], file: new Istantanea([png(1)], nome, { type: 'image/png' }), dirHandle: cartellaCon(nome, png(9)) };
};

// =============================================================================
console.log('\n--- foto ritoccata in un altro programma, aperta con una cartella ---');
{
    const app = nuovaApp([fotoRitoccata('a')]);
    const n = await app.una('a');
    dice('una foto: la richiesta parte (una sola)', app.mandati().length === 1, `richieste ${app.mandati().length}, notifiche ${JSON.stringify(app.notifiche)}`);
    dice('una foto: parte la versione di ADESSO, riletta dalla cartella', app.mandati()[0]?.equals(Buffer.from(png(9))) === true);
    dice('una foto: i tag arrivano sulla foto', n === 2 && app.foto[0].tags.join(',') === 'cat,sofa', `n ${n}, tag ${app.foto[0].tags}`);
}
{
    const app = nuovaApp([fotoRitoccata('a'), fotoRitoccata('b')]);
    await app.tutte();
    const finale = app.notifiche.at(-1)?.[0] || '';
    dice('in blocco: partono tutte e due', app.mandati().length === 2, `richieste ${app.mandati().length}`);
    const atteso = t.aiBatchDone.replace('{ok}', '2').replace('{err}', '0').replace('{skip}', '0').replace('{n}', '4');
    dice('in blocco: il riepilogo dice 2 taggate, 0 non riuscite', finale === atteso, `avuto ${finale}\n        atteso ${atteso}`);
}

console.log('\n--- foto senza cartella che non si legge piu\' ---');
{
    const foto = [{ id: 'c', isTrashed: false, tags: [], file: new Istantanea([png(1)], 'c.png', { type: 'image/png' }) }];
    const app = nuovaApp(foto);
    await app.una('c');
    const m = app.notifiche.at(-1)?.[0] || '';
    dice('nessuna richiesta parte', app.mandati().length === 0);
    dice('il messaggio dice che la foto non si legge piu\' (aiPhotoUnreadable)', !!t.aiPhotoUnreadable && m.includes(t.aiPhotoUnreadable), m);
}

console.log('\n--- dati nascosti che non si sanno togliere ---');
const errMetadati = () => Object.assign(new Error('Hidden data cannot be removed'), { geminiKind: 'photo', motivoFoto: 'metadati' });
{
    const app = nuovaApp([{ id: 'd', isTrashed: false, tags: [], file: new File([png(1)], 'd.heic', { type: 'image/heic' }) }],
        async () => { throw errMetadati(); });
    await app.una('d');
    const m = app.notifiche.at(-1)?.[0] || '';
    dice('una foto: il messaggio spiega i dati nascosti (aiPhotoHiddenData)', !!t.aiPhotoHiddenData && m.includes(t.aiPhotoHiddenData), m);
}
{
    const foto = ['e', 'f', 'g'].map(id => ({ id, isTrashed: false, tags: [], file: new File([png(1)], id + '.png', { type: 'image/png' }) }));
    const app = nuovaApp(foto, async (f) => { if (f.id === 'f' || f.id === 'g') throw errMetadati(); return ['cat']; });
    await app.tutte();
    const finale = app.notifiche.at(-1)?.[0] || '';
    const atteso = (t.aiBatchHiddenData || '').replace('{n}', '2');
    dice('in blocco: il riepilogo aggiunge quante non sono partite per i dati nascosti', !!t.aiBatchHiddenData && finale.endsWith(' ' + atteso), finale);
}
{
    const foto = ['h'].map(id => ({ id, isTrashed: false, tags: [], file: new File([png(1)], id + '.png', { type: 'image/png' }) }));
    const app = nuovaApp(foto, async () => ['cat']);
    await app.tutte();
    const finale = app.notifiche.at(-1)?.[0] || '';
    dice('in blocco, nessuna foto con dati nascosti: il riepilogo resta com\'era', !finale.includes((t.aiBatchHiddenData || '§').split('{n}')[0]), finale);
}

console.log(`\n${fatti - guai}/${fatti} prove superate`);
if (fatti === 0 || guai > 0) process.exit(1);
