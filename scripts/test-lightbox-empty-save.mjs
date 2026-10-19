/* ITALIANO: PROVA DEL MESSAGGIO DI "SALVA FILE .TXT" (VISUALIZZATORE) SU UNA FOTO SENZA TAG E SENZA .TXT
   Il programma giustamente non crea un .txt vuoto nuovo (Kohya si ferma su un .txt vuoto), ma
   diceva comunque "File TXT salvato con successo!" in verde: l'utente credeva di avere una
   didascalia che sul disco non c'e'. Ora dice che non e' stato scritto nessun file, con un avviso
   informativo. Si esegue il testo VERO di handleSaveSingleTxt (src/components/Lightbox.tsx) in
   tutti e due i rami: cartella aperta e "Carica immagini" in Electron. Casi vicini che non devono
   cambiare: foto con tag (salvata, messaggio verde) e .txt che c'era svuotato (messaggio con la
   frase del .txt vuoto).
   Uso:  node scripts/test-lightbox-empty-save.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE VIEWER'S "SAVE .TXT FILE" MESSAGE ON A PHOTO WITH NO TAGS AND NO .TXT
   The app rightly does not create a new empty .txt (Kohya stops on an empty .txt), but still said
   "TXT file saved successfully!" in green: the user believed there was a caption that is not on
   disk. Now it says no file was written, with an info notice. The REAL text of handleSaveSingleTxt
   (src/components/Lightbox.tsx) runs in both branches: open folder and "Load images" in Electron.
   Neighbouring cases that must not change: photo with tags (saved, green message) and an existing
   .txt emptied (message with the empty .txt sentence).
   Usage:  node scripts/test-lightbox-empty-save.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const P = await carica('src/utils/pathUtils.ts');
const lingue = (await carica('src/constants.ts')).translations;
const t = lingue.en;

const sorgente = fs.readFileSync(path.join(radice, 'src/components/Lightbox.tsx'), 'utf8');
const intestazione = '    const handleSaveSingleTxt = async () => {';
const inizio = sorgente.indexOf(intestazione);
const chiusura = /\r?\n    \};\r?\n/g;
chiusura.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : chiusura.exec(sorgente);
if (inizio < 0 || !fine) { console.log('NO  handleSaveSingleTxt non trovato in Lightbox.tsx'); process.exit(1); }
const js = (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'tsx' })).code;
const muto = { log() { }, warn() { }, error() { } };

// ITALIANO: cartella finta: getFileHandle senza { create: true } su un file che manca da' NotFoundError.
// ENGLISH: fake folder: getFileHandle without { create: true } on a missing file gives NotFoundError.
const cartella = (presenti = {}) => {
    const c = { file: new Map(Object.entries(presenti)) };
    c.getFileHandle = async (nome, opz) => {
        if (!c.file.has(nome) && !(opz && opz.create)) throw new DOMException('not found', 'NotFoundError');
        return { createWritable: async () => { let testo = ''; return { write: async (s) => { testo += String(s); }, close: async () => { c.file.set(nome, testo); } }; } };
    };
    return c;
};
const salvaUna = async ({ dir = null, finestra = {}, tags = [], originalTags = [] }) => {
    const notifiche = [];
    let salvata = false;
    const f = new Function('orderTags', 'currentTags', 'image', 'dirHandle', 'updateOriginalTags', 'soundManager', 'showNotification', 't', 'window', 'console',
        'buildTagFileName', 'sidecarTagFileName',
        js + '\nreturn handleSaveSingleTxt;')((x) => x, tags, { id: '1', file: { name: 'a.png' }, originalTags }, dir, () => { salvata = true; }, { chime() { } },
        (m, tipo) => notifiche.push([m, tipo]), t, finestra, muto, P.buildTagFileName, P.sidecarTagFileName);
    await f();
    return { notifiche, salvata, ultimo: notifiche[notifiche.length - 1] || null };
};
const electronFinto = (scritti) => ({
    electronAPI: {
        getPathForFile: () => 'E:/foto/a.png',
        writeSidecarTags: async (voci) => { scritti.push(...voci); return { results: voci.map(() => true) }; },
    },
});

console.log('\n--- cartella aperta: foto senza tag e senza .txt ---');
{
    const dir = cartella();
    const r = await salvaUna({ dir });
    dice('nessun a.txt creato', false, dir.file.has('a.txt'));
    dice('la foto risulta salvata (come prima)', true, r.salvata);
    dice('il messaggio NON dice "salvato con successo"', false, !!r.ultimo && r.ultimo[0].includes(t.successSaveSingle));
    dice('il messaggio dice che nessun .txt e\' stato scritto, di tipo info', [t.saveNoTagsNoFile, 'info'], r.ultimo);
}

console.log('\n--- "Carica immagini" in Electron: foto senza tag e senza .txt sul disco ---');
{
    const scritti = [];
    const r = await salvaUna({ finestra: electronFinto(scritti) });
    dice('il processo principale riceve il contenuto vuoto (e non crea il file)', [''], scritti.map(v => v.content));
    dice('la foto risulta salvata (come prima)', true, r.salvata);
    dice('il messaggio dice che nessun .txt e\' stato scritto, di tipo info', [t.saveNoTagsNoFile, 'info'], r.ultimo);
}

console.log('\n--- casi vicini che non cambiano ---');
{
    const dir = cartella({ 'a.txt': 'smile,' });
    const r = await salvaUna({ dir, originalTags: ['smile'] });
    dice('cartella, il .txt c\'era: si svuota e il messaggio parla del .txt vuoto', ['', true, 'info'],
        [dir.file.get('a.txt'), !!r.ultimo && r.ultimo[0] === t.successSaveSingle + ' ' + t.saveEmptyCaptionOne, r.ultimo && r.ultimo[1]]);
    const scritti = [];
    const r2 = await salvaUna({ finestra: electronFinto(scritti), originalTags: ['smile'] });
    dice('Electron, la foto aveva tag sul disco: messaggio del .txt vuoto', [t.successSaveSingle + ' ' + t.saveEmptyCaptionOne, 'info'], r2.ultimo);
    const dir3 = cartella();
    const r3 = await salvaUna({ dir: dir3, tags: ['red hair'] });
    dice('cartella, foto con tag: .txt scritto e messaggio verde', ['red hair,', [t.successSaveSingle, 'success']], [dir3.file.get('a.txt'), r3.ultimo]);
    const scritti4 = [];
    const r4 = await salvaUna({ finestra: electronFinto(scritti4), tags: ['red hair'] });
    dice('Electron, foto con tag: messaggio verde', [['red hair,'], [t.successSaveSingle, 'success']], [scritti4.map(v => v.content), r4.ultimo]);
}

console.log('\n--- la frase esiste nelle nove lingue ---');
dice('saveNoTagsNoFile in it/en/fr/es/de/zh/ja/pt/ru', [],
    ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'].filter(l => typeof lingue[l].saveNoTagsNoFile !== 'string' || !lingue[l].saveNoTagsNoFile.trim()));

process.exit(esito());
