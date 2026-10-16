/* ITALIANO: PROVA DELLA MEMORIA USATA DA "Esporta (.zip)" CON LE FOTO DENTRO
   La finestra di scelta prometteva "l'archivio viene scritto direttamente sul disco, un pezzo per
   volta: puoi esportare anche dataset grandi". Non era vero: JSZip leggeva SUBITO ogni foto per
   intero (mentre la finestra di salvataggio era ancora aperta) e le teneva tutte in memoria fino
   alla fine. Con un dataset piu' grande della RAM libera la finestra moriva; oltre i 4 GB, per di
   piu', JSZip non scrive lo ZIP64 e l'archivio usciva rovinato.
   Si esegue il testo VERO di exportAllAsZip (src/App.tsx) col banco di prova export-harness.mjs:
   8 foto da 2 MB, lette solo dopo la scelta del file, una alla volta, con al massimo una foto in
   memoria; l'archivio si rilegge con JSZip (CRC controllato). Poi lo scrittore vero
   (src/utils/zipWriter.ts) con le soglie ZIP64 abbassate, per provarne il formato senza 4 GB.
   Uso:  node scripts/test-export-zip-memory.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE MEMORY USED BY "Export (.zip)" WITH THE PHOTOS IN
   The choice dialog promised "the archive is written straight to disk, a chunk at a time, so even
   large datasets work". It was not true: JSZip read every photo WHOLE right away (while the save
   dialog was still open) and kept them all in memory to the end. With a dataset larger than the
   free RAM the window died; past 4 GB, on top of that, JSZip writes no ZIP64 and the archive came
   out broken.
   The REAL text of exportAllAsZip (src/App.tsx) runs on the export-harness.mjs bench: 8 photos of
   2 MB, read only after the file is picked, one at a time, with at most one photo in memory; the
   archive is read back with JSZip (CRC checked). Then the real writer (src/utils/zipWriter.ts) with
   the ZIP64 thresholds lowered, to test its format without 4 GB.
   Usage:  node scripts/test-export-zip-memory.mjs      (exits with code 1 if anything is off) */

import { creaControlli } from './main-harness.mjs';
import { creaApp, creaSonda, FotoFinta, byteDi, zipWriter, JSZip, t } from './export-harness.mjs';

const { dice, esito } = creaControlli();
const MB = 1024 * 1024;
const DIM = 2 * MB;

console.log('\n--- "Tag e immagini": 8 foto da 2 MB ---');
{
    const sonda = creaSonda();
    const images = Array.from({ length: 8 }, (_, i) => {
        const nome = `p${i + 1}.png`;
        return { id: nome, file: new FotoFinta(byteDi(DIM, i), nome, sonda), tags: ['tag' + i], isTrashed: false };
    });
    const r = await creaApp(images, sonda).esporta(true);
    const voci = await r.archivio();
    dice('premessa: l\'archivio c\'e\', con 8 foto e 8 .txt identici agli originali', true,
        !!voci && Object.keys(voci).length === 16 && images.every((img, i) => voci[img.id] && voci[img.id].equals(Buffer.from(byteDi(DIM, i)))));
    const scelto = sonda.eventi.indexOf('file scelto');
    const primaLettura = sonda.eventi.findIndex(e => e.startsWith('lettura '));
    dice('nessuna foto si legge mentre la finestra di salvataggio e\' ancora aperta', true, scelto >= 0 && primaLettura > scelto);
    dice('mai due foto lette nello stesso momento', 1, sonda.maxInVolo);
    dice(`in memoria al massimo una foto (2 MB), non il dataset (16 MB): picco ${(sonda.piccoTrattenuto / MB).toFixed(1)} MB`, true, sonda.piccoTrattenuto <= DIM);
    dice('il file di destinazione si chiude (non si annulla)', [true, false], [r.chiuso, r.annullato]);
}

console.log('\n--- quello che NON deve cambiare: browser senza finestra di salvataggio ---');
{
    const sonda = creaSonda();
    const images = [0, 1].map(i => ({ id: `q${i}.png`, file: new FotoFinta(byteDi(3000, i), `q${i}.png`, sonda), tags: ['t'], isTrashed: false }));
    const r = await creaApp(images, sonda, { conFinestra: false }).esporta(true);
    const zip = r.scaricato ? await JSZip.loadAsync(Buffer.from(await r.scaricato.arrayBuffer()), { checkCRC32: true }) : null;
    dice('l\'archivio si scarica e si rilegge: 2 foto e 2 .txt', ['q0.png', 'q0.txt', 'q1.png', 'q1.txt'], zip ? Object.keys(zip.files).sort() : null);
    dice('e si dice che e\' fatto', [t.zipSuccess, 'success'], r.notifiche[r.notifiche.length - 1]);
}

const Z = zipWriter;
if (typeof Z.scriviZip !== 'function') {
    dice('src/utils/zipWriter.ts esporta scriviZip', true, false);
} else {
    const scrivi = async (voci, opzioni) => {
        const pezzi = [];
        await Z.scriviZip(voci, { write: async (p) => { pezzi.push(Buffer.from(p)); } }, opzioni);
        return Buffer.concat(pezzi);
    };
    const rilegge = async (byte) => {
        const zip = await JSZip.loadAsync(byte, { checkCRC32: true });
        const out = {};
        for (const n of Object.keys(zip.files).sort()) out[n] = Buffer.from(await zip.files[n].async('uint8array')).toString('hex');
        return out;
    };
    const esa = (s) => Buffer.from(s).toString('hex');
    const VOCI = () => [
        { nome: 'piccolo.txt', dati: 'a, b,' },
        { nome: 'grande.txt', dati: 'x'.repeat(300) },
        { nome: 'foto.png', dati: new Blob([byteDi(5000, 3)]) },
        { nome: 'cartella/àccentato.txt', dati: 'ciao' },
        { nome: 'pigra.png', dati: async () => new Blob([byteDi(700, 9)]) },
    ];
    const ATTESO = {
        'cartella/àccentato.txt': esa('ciao'), 'foto.png': Buffer.from(byteDi(5000, 3)).toString('hex'),
        'grande.txt': esa('x'.repeat(300)), 'piccolo.txt': esa('a, b,'), 'pigra.png': Buffer.from(byteDi(700, 9)).toString('hex'),
    };
    const firma64 = Buffer.from([0x50, 0x4b, 0x06, 0x06]);

    console.log('\n--- lo scrittore: formato normale ---');
    const normale = await scrivi(VOCI(), {});
    dice('JSZip lo rilegge uguale (CRC controllato), anche il nome accentato', ATTESO, await rilegge(normale));
    dice('sotto i 4 GB niente record ZIP64', false, normale.includes(firma64));

    console.log('\n--- lo scrittore: ZIP64 (soglie abbassate a 100 byte e 3 voci) ---');
    const grande = await scrivi(VOCI(), { limite32: 100, limite16: 3 });
    dice('ci sono i record ZIP64 di fine archivio', true, grande.includes(firma64));
    dice('JSZip lo rilegge uguale: voci sotto e sopra la soglia, posizioni oltre la soglia', ATTESO, await rilegge(grande));

    console.log('\n--- lo scrittore: un file letto a pezzi ---');
    const sonda = creaSonda();
    const lungo = new FotoFinta(byteDi(10 * 1024, 5), 'lungo.png', sonda);
    const pezzi = await scrivi([{ nome: 'lungo.png', dati: lungo }], { pezzo: 1024 });
    dice('10 KB letti in 10 pezzi da 1 KB, uno alla volta', [10 * 1024, 1], [sonda.letti, sonda.maxInVolo]);
    dice('e rimessi insieme giusti', { 'lungo.png': Buffer.from(byteDi(10 * 1024, 5)).toString('hex') }, await rilegge(pezzi));
}

process.exit(esito());
