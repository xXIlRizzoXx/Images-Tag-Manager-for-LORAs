/* ITALIANO: PROVA DEI .txt NON IN UTF-8 (UTF-16 DI POWERSHELL / BLOCCO NOTE, ANSI CON ACCENTI)
   Un .txt scritto da Windows PowerShell 5.1 ('woman, red hair' > a.txt, UTF-16 con BOM) o dal Blocco
   note in "Unicode" si leggeva come "��w o m a n", "r e d   h a i r"; un .txt ANSI con
   "café" diventava "caf�". Nessun avviso, e con una trigger attiva "Salva modifiche" scriveva la
   spazzatura SOPRA il file vero: testo originale e lettere accentate persi per sempre.
   Ora i byte si decodificano: UTF-16 (con il BOM) si legge bene, UTF-8 come prima, e un file che
   non e' UTF-8 valido (ANSI) non si inventa: e' un .txt non letto, nominato nell'avviso dei .txt
   saltati e protetto da Salva (come quelli oltre 1 MB). Vale per tutte le strade: "Carica
   cartella" (processImportData), "Carica immagini" e trascinamento (canale del processo
   principale), e l'editor dei file di tag.
   Si eseguono i pezzi VERI: le regole di src/utils/sidecarTags.ts, il canale di electron/main.cjs su
   una cartella temporanea e processImportData di src/App.tsx (compilato con esbuild).
   Uso:  node scripts/test-sidecar-encoding.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE NON-UTF-8 .txt FILES (UTF-16 FROM POWERSHELL / NOTEPAD, ANSI WITH ACCENTS)
   A .txt written by Windows PowerShell 5.1 (UTF-16 with BOM) or by Notepad as "Unicode" was read
   as garbage; an ANSI .txt with "café" became "caf�". No notice, and with an active trigger
   "Save changes" wrote the garbage OVER the real file. Now the bytes are decoded: UTF-16 (with
   the BOM) reads fine, UTF-8 as before, and a file that is not valid UTF-8 (ANSI) is not made up:
   it is an unread .txt, named in the skipped-.txt notice and protected from Save. On every road:
   "Load folder", "Load images" and drag and drop (main-process channel), the tag file editor.
   Usage:  node scripts/test-sidecar-encoding.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { caricaMain, creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'));
const S = await carica('src/utils/sidecarTags.ts');
const B = await carica('src/utils/tagBackup.ts');
const N = await carica('src/utils/importNotice.ts');
const t = (await carica('src/constants.ts')).translations.en;

// ITALIANO: i byte dei file di prova, come li scrivono i programmi di Windows.
// ENGLISH: the test files' bytes, as Windows programs write them.
const utf16le = (s) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(s, 'utf16le')]);
const utf16be = (s) => Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(s, 'utf16le').swap16()]);
const utf8bom = (s) => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(s, 'utf8')]);
const ansi = (s) => Buffer.from(s, 'latin1');
const FILE = {
    'ps.txt': utf16le('woman, red hair\r\n'),
    'be.txt': utf16be('woman, red hair'),
    'bom.txt': utf8bom('café, smiling'),
    'u8.txt': Buffer.from('café, smiling', 'utf8'),
    'ansi.txt': ansi('café, smiling'),
    'nobom16.txt': Buffer.from('woman, red hair', 'utf16le'),
};
const ATTESI = { 'ps.txt': ['woman', 'red hair'], 'be.txt': ['woman', 'red hair'], 'bom.txt': ['café', 'smiling'], 'u8.txt': ['café', 'smiling'] };
const NON_LEGGIBILI = ['ansi.txt', 'nobom16.txt'];

console.log('\n--- la regola di decodifica (sidecarTags) ---');
const decodifica = typeof S.decodificaSidecar === 'function' ? S.decodificaSidecar : null;
dice('premessa: sidecarTags ha la regola decodificaSidecar', true, Boolean(decodifica));
for (const [nome, attesi] of Object.entries(ATTESI)) {
    const testo = decodifica ? decodifica(new Uint8Array(FILE[nome])) : null;
    dice(`${nome}: tag ${JSON.stringify(attesi)}`, attesi, testo === null ? null : S.parseSidecarText(testo).tags);
}
for (const nome of NON_LEGGIBILI) dice(`${nome}: non leggibile (null), niente testo inventato`, null, decodifica ? decodifica(new Uint8Array(FILE[nome])) : 'regola assente');
dice('un file vuoto resta un testo vuoto', '', decodifica ? decodifica(new Uint8Array(0)) : null);

console.log('\n--- "Carica immagini" e trascinamento: il canale del processo principale ---');
const { handlers } = caricaMain();
const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-sidecar-encoding-'));
let letti = [];
try {
    for (const [nome, byte] of Object.entries(FILE)) {
        fs.writeFileSync(path.join(cartella, nome.replace('.txt', '.png')), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        fs.writeFileSync(path.join(cartella, nome), byte);
    }
    letti = handlers.get('images:read-sidecar-tags')(null, Object.keys(FILE).map(n => path.join(cartella, n.replace('.txt', '.png'))));
} finally {
    fs.rmSync(cartella, { recursive: true, force: true });
}
const dalCanale = new Map(letti.map(s => [s.name, s]));
for (const [nome, attesi] of Object.entries(ATTESI)) {
    const s = dalCanale.get(nome);
    dice(`${nome}: il canale lo manda decodificato`, attesi, s && typeof s.content === 'string' ? S.parseSidecarText(s.content).tags : null);
}
for (const nome of NON_LEGGIBILI) dice(`${nome}: il canale lo segnala come saltato (skipped), senza testo`, [true, false], [dalCanale.get(nome)?.skipped === true, 'content' in (dalCanale.get(nome) || {})]);

console.log('\n--- "Carica immagini": il .txt saltato dal canale resta non leggibile ---');
{
    const lettura = typeof S.leggiTestoSidecar === 'function' ? S.leggiTestoSidecar : null;
    dice('premessa: sidecarTags ha leggiTestoSidecar', true, Boolean(lettura));
    let rifiutato = false;
    try { await (lettura || ((f) => f.text()))(S.fileDaSidecar({ name: 'a.txt', skipped: true })); } catch { rifiutato = true; }
    dice('un .txt saltato non si legge nemmeno dai byte (non diventa un file vuoto)', true, rifiutato);
    const buono = S.fileDaSidecar({ name: 'b.txt', content: 'café, smiling' });
    dice('un .txt letto dal canale si rilegge uguale', 'café, smiling', lettura ? await lettura(buono) : null);
}

console.log('\n--- "Carica cartella": processImportData con i file veri ---');
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('    const processImportData = async (');
const chiusura = /\r?\n    \};\r?\n/g;
chiusura.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : chiusura.exec(sorgente);
if (inizio < 0 || !fine) { console.log('NO  processImportData non trovato in src/App.tsx'); process.exit(1); }
const testo = sorgente.slice(inizio, fine.index + fine[0].length);
const codice = (await esbuild.transform(testo, { loader: 'ts' })).code;
const NOTI = ['globalTriggersRef', 'anteprimeProgettoRef', 'folderInputRef'];
const altriRef = [...new Set(testo.match(/\b\w+Ref\b/g) || [])].filter(n => !NOTI.includes(n));
const NOMI = ['globalTriggersRef', 'setImages', 'setImportSummary', 'setDirHandle', 'setIsImporting', 'setImportProgress',
    'folderSignature', 'nuovoIdFoto', 'backupDellImport', 'localStorage', 'makeFolderKeyer', 'makeBackupKeyer', 'TXT_MAX_BYTES',
    'parseSidecarText', 'generateThumbnail', 'tagDiImport', 'tagDaRipristinare', 'asDirHandle', 'anteprimeProgettoRef',
    'soundManager', 'avvisoImport', 't', 'showNotification', 'folderInputRef', 'console', 'URL', 'leggiTestoSidecar', ...altriRef];
const processImportData = new Function(...NOMI, codice + '\nreturn processImportData;');
{
    let immagini = [];
    const notifiche = [];
    let id = 0;
    const importa = processImportData({ current: ['ohwx'] }, (f) => { immagini = typeof f === 'function' ? f(immagini) : f; }, () => { }, () => { },
        () => { }, () => { }, B.folderSignature, () => 'id' + (++id), B.backupDellImport, { getItem: () => null }, S.makeFolderKeyer,
        () => (f) => 'dataset\x1f' + f.name, 1024 * 1024, S.parseSidecarText, async () => ({ url: '', width: 1, height: 1 }), S.tagDiImport,
        B.tagDaRipristinare, () => null, { current: new Set() }, { chime() { } }, N.avvisoImport, t, (m, tipo) => notifiche.push([m, tipo]),
        { current: null }, { log() { }, warn() { }, error() { } }, { revokeObjectURL() { } }, S.leggiTestoSidecar, ...altriRef.map(() => ({ current: 0 })));
    const nomi = Object.keys(FILE);
    await importa(nomi.map(n => ({ name: n.replace('.txt', '.png') })), nomi.map(n => new File([FILE[n]], n, { type: 'text/plain' })));
    const foto = (n) => immagini.find(i => i.file.name === n.replace('.txt', '.png'));
    for (const [nome, attesi] of Object.entries(ATTESI)) dice(`${nome}: la foto arriva con i tag giusti (trigger in testa)`, ['ohwx', ...attesi], foto(nome)?.tags);
    for (const nome of NON_LEGGIBILI) {
        const f = foto(nome);
        dice(`${nome}: la foto non risulta da salvare con la trigger attiva (Salva non ci scrive sopra)`, false, f ? S.fotoDaSalvare(f, ['ohwx']) : null);
    }
    dice('le altre foto con la trigger nuova restano da salvare (come prima)', true, S.fotoDaSalvare(foto('u8.txt'), ['ohwx']));
    dice('l\'avviso nomina i due .txt non letti', [[N.avvisoImport(t, { caricate: 6, ripristinate: 0, saltati: 2, accorciati: 0, nomiSaltati: NON_LEGGIBILI }).testo, 'info']], notifiche);
}

console.log('\n--- l\'editor dei file di tag legge con la stessa regola ---');
{
    const ed = fs.readFileSync(path.join(radice, 'src/components/TagFileEditor.tsx'), 'utf8');
    dice('nessuna lettura con file.text() (che decodifica sempre in UTF-8)', 0, (ed.match(/\bfile\.text\(\)/g) || []).length);
    dice('...le tre letture passano da leggiTestoSidecar', 3, (ed.match(/await leggiTestoSidecar\(file\)/g) || []).length);
}

process.exit(esito());
