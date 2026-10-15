/* ITALIANO: PROVA DI "GENERA TAG CON AI" SU UNA FOTO CHE SPARISCE MENTRE GOOGLE RISPONDE
   Si avvia l'AI su una foto nel visualizzatore e, mentre Google risponde, si chiude la foto con la
   sua X, si preme "Chiudi progetto" o "Reset". La richiesta della singola foto non si ferma: quando
   arrivava la risposta, l'app suonava e mostrava il verde "Tag generati: 12" nel progetto vuoto (o
   in quello nuovo), senza mettere i tag da nessuna parte. Ora, come fa gia' "Tagga tutte" con una
   foto uscita a meta' richiesta, il risultato si scarta in silenzio (solo una riga nella console).
   Si esegue il testo VERO di handleAITagSingle preso da src/App.tsx, con la regola vera di
   src/utils/tagCase.ts e un Google finto (nessuna rete, nessuna chiave).
   Uso:  node scripts/test-ai-single-removed.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "GENERATE TAGS WITH AI" ON A PHOTO THAT GOES AWAY WHILE GOOGLE ANSWERS
   The AI is started on a photo in the viewer and, while Google answers, the photo is closed with
   its X, or "Close project" or "Reset" is pressed. The single-photo request does not stop: when the
   answer came, the app chimed and showed the green "Tags generated: 12" in the empty (or new)
   project, with no tags put anywhere. Now, as "Auto-tag all" already does with a photo removed
   mid-request, the result is dropped silently (only a line in the console).
   The REAL text of handleAITagSingle taken from src/App.tsx is run, with the real rule of
   src/utils/tagCase.ts and a fake Google (no network, no key).
   Usage:  node scripts/test-ai-single-removed.mjs      (exits with code 1 if anything is off) */

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
const C = await carica('src/utils/tagCase.ts');
const t = (await carica('src/constants.ts')).translations.en;

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('    const handleAITagSingle = useCallback(');
const fineRegex = /\r?\n    \}, \[aiEnabled, geminiApiKey, aiModel, aiMaxTags, aiCustomPrompt, images, t, updateImageTags\]\);\r?\n/g;
fineRegex.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : fineRegex.exec(sorgente);
if (!fine) { console.log('NO  handleAITagSingle non trovato in src/App.tsx'); process.exit(1); }
const codice = (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
const DIP = ['aiEnabled', 'geminiApiKey', 'aiModel', 'aiMaxTags', 'aiCustomPrompt', 'images', 'imagesRef', 't', 'updateImageTags',
    'getGeminiTags', 'classifyGeminiError', 'showNotification', 'soundManager', 'setRiparaModello', 'setIsApiKeyDialogOpen', 'setIsAIBusy',
    'countNewTagsIgnoringCase', 'useCallback', 'console'];
const fabbrica = new Function(...DIP, codice + '\nreturn handleAITagSingle;');
const muto = { log() { }, warn() { }, error() { } };

// ITALIANO: tagga la foto 'f0'; `mentreAttende(rif)` cambia l'elenco vivo mentre Google risponde.
// ENGLISH: tags photo 'f0'; `mentreAttende(rif)` changes the live list while Google answers.
const una = async (mentreAttende) => {
    const foto = [{ id: 'f0', isTrashed: false, tags: ['smile'], file: { name: 'f0.png' } }, { id: 'f1', isTrashed: false, tags: [], file: { name: 'f1.png' } }];
    const r = { notifiche: [], suoni: 0, aggiornate: [], occupato: [] };
    const imagesRef = { current: foto };
    const dip = {
        aiEnabled: true, geminiApiKey: 'chiave-finta', aiModel: 'gemini-flash', aiMaxTags: 30, aiCustomPrompt: '',
        images: foto, imagesRef, t, updateImageTags: (id, tags) => r.aggiornate.push([id, tags]),
        getGeminiTags: async () => { await new Promise((ok) => setTimeout(ok, 5)); mentreAttende(imagesRef); return ['red hair', 'blue eyes']; },
        classifyGeminiError: () => ({ kind: 'unknown', quotaGiorno: false }),
        showNotification: (m, tipo) => r.notifiche.push([m, tipo]), soundManager: { chime() { r.suoni++; } },
        setRiparaModello: () => { }, setIsApiKeyDialogOpen: () => { }, setIsAIBusy: (v) => r.occupato.push(v),
        countNewTagsIgnoringCase: C.countNewTagsIgnoringCase, useCallback: (f) => f, console: muto,
    };
    r.restituito = await fabbrica(...DIP.map(n => dip[n]))('f0');
    return r;
};

console.log('\n--- la foto sparisce mentre Google risponde ---');
for (const [nome, cambia] of [
    ['progetto chiuso (o Reset): l\'elenco e\' vuoto', (rif) => { rif.current = []; }],
    ['foto chiusa con la X: le altre restano', (rif) => { rif.current = rif.current.filter(f => f.id !== 'f0'); }],
    ['progetto nuovo aperto: altre foto, altri id', (rif) => { rif.current = [{ id: 'n0', isTrashed: false, tags: [], file: { name: 'f0.png' } }]; }],
]) {
    const r = await una(cambia);
    dice(`${nome}: nessun avviso verde, nessun suono, nessun tag messo, restituisce 0`,
        [[], 0, [], 0], [r.notifiche.filter(([, tipo]) => tipo === 'success'), r.suoni, r.aggiornate, r.restituito]);
    dice('...e il pulsante dell\'AI torna libero', false, r.occupato[r.occupato.length - 1]);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = await una(() => { });
    dice('la foto c\'e\' ancora: i tag si aggiungono a quelli che ha, avviso verde col numero e suono',
        [[['f0', ['smile', 'red hair', 'blue eyes']]], [[t.aiTagsGenerated.replace('{n}', '2'), 'success']], 1, 2],
        [r.aggiornate, r.notifiche, r.suoni, r.restituito]);
    const r2 = await una((rif) => { rif.current = rif.current.map(f => f.id === 'f0' ? { ...f, tags: ['smile', 'Red Hair'] } : f); });
    dice('tag cambiati a mano durante l\'attesa: si parte da quelli vivi e si contano solo i nuovi',
        [['f0', ['smile', 'Red Hair']], [[t.aiTagsGenerated.replace('{n}', '1'), 'success']], 1],
        [[r2.aggiornate[0]?.[0], r2.aggiornate[0]?.[1].slice(0, 2)], r2.notifiche, r2.restituito]);
}

process.exit(esito());
