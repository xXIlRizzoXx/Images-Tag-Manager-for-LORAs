/* ITALIANO: PROVA DEL RIMEDIO NELL'ERRORE AI "QUESTA FOTO NON SI LEGGE PIU'"
   Una foto aperta senza cartella ("Carica immagini", trascinata) tiene l'istantanea presa
   all'importazione: ritoccata in un altro programma non si legge piu', e il tasto AI lo dice.
   Il rimedio diceva solo "caricala di nuovo e riprova": ma il controllo delle foto gia' aperte
   (fotoGiaAperte) riconosce lo stesso percorso e la scarta ("Foto gia' aperte, non aggiunte di
   nuovo"), la vecchia istantanea resta e l'AI fallisce di nuovo, senza uscita.
   Il rimedio vero e' togliere prima la foto dal progetto con la X della sua scheda ("Chiudi
   immagine"), che non tocca il disco, e poi caricarla di nuovo. Non con "Sposta nel Cestino": le
   foto nel cestino dell'app contano ancora come aperte, e svuotandolo il file VERO finirebbe nel
   Cestino di Windows.
   Si controlla: in tutte e nove le lingue l'errore nomina "Chiudi immagine" con la sua etichetta
   vera e non manda nel cestino; con il vero fotoGiaAperte la foto con lo stesso percorso e'
   scartata finche' e' aperta ed entra di nuovo dopo averla chiusa.
   Uso:  node scripts/test-ai-unreadable-remedy.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE REMEDY IN THE AI ERROR "THIS PHOTO CAN NO LONGER BE READ"
   A photo opened without a folder ("Load images", dropped) keeps the snapshot taken at import:
   retouched in another program it can no longer be read, and the AI button says so. The remedy
   only said "load it again and try once more": but the already-open check (fotoGiaAperte)
   recognises the same path and drops it ("Photos already open, not added again"), the old
   snapshot stays and the AI fails again, with no way out.
   The real remedy is to take the photo out of the project first with its card's X ("Close
   image"), which does not touch the disk, and then load it again. Not with "Move to Trash": the
   photos in the app's trash still count as open, and emptying it would send the REAL file to the
   Windows Recycle Bin.
   Checked: in all nine languages the error names "Close image" by its real label and does not send
   to the trash; with the real fotoGiaAperte the photo with the same path is dropped while it is
   open and comes in again once it is closed.
   Usage:  node scripts/test-ai-unreadable-remedy.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

const carica = async (file) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, file)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const { translations } = await carica('src/constants.ts');
const { fotoGiaAperte } = await carica('src/utils/alreadyOpen.ts');
const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');

// ITALIANO: premesse: l'errore 'illeggibile' del tasto AI mostra aiPhotoUnreadable; la X della
//           scheda e' "Chiudi immagine" e toglie la foto dall'elenco senza cestinarla.
// ENGLISH: premises: the AI button's 'illeggibile' error shows aiPhotoUnreadable; the card's X is
//          "Close image" and removes the photo from the list without trashing it.
dice('premessa: la foto illeggibile mostra aiPhotoUnreadable', true, /motivoFoto === 'illeggibile' \? t\.aiPhotoUnreadable/.test(app));
dice('premessa: la scheda ha la X "Chiudi immagine"', true, /onClose\(img\.id\)[^\n]*title=\{t\.closeImageTitle\}/.test(app));
const i = app.indexOf('const handleCloseImage = useCallback(');
const corpo = i < 0 ? '' : app.slice(i, app.indexOf('\n    }, [t]);', i));
dice('premessa: chiudere toglie la foto dal progetto', true, /setImages\(prev => prev\.filter\(i => i\.id !== id\)\)/.test(corpo));
dice('premessa: chiudere non cestina e non tocca il disco', false, /isTrashed|trashFiles|deleteImageFiles/.test(corpo));

// ITALIANO: il giro senza uscita con il vero fotoGiaAperte: stessa foto, stesso percorso, nessuna
//           cartella (come "Carica immagini").
// ENGLISH: the dead end with the real fotoGiaAperte: same photo, same path, no folder (as with
//          "Load images").
const percorso = 'C:\\dataset\\foto_01.jpg';
const nuova = { name: 'foto_01.jpg' };
const descrivi = () => ({ percorso, nome: 'foto_01.jpg', cartella: null });
const aperta = { percorso, nome: 'foto_01.jpg', cartella: null };
const finche = await fotoGiaAperte([nuova], descrivi, [aperta]);
dice('premessa: ricaricarla mentre e\' aperta viene scartato ("gia\' aperte")', true, finche.has(nuova));
const dopo = await fotoGiaAperte([nuova], descrivi, []);
dice('dopo averla chiusa con la X, ricaricarla la fa entrare', false, dopo.has(nuova));

const ATTESE = ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'];
for (const codice of ATTESE) {
    const l = translations[codice] || {};
    const avviso = String(l.aiPhotoUnreadable || '');
    dice(`[${codice}] l'errore AI esiste`, true, avviso.length > 0);
    dice(`[${codice}] l'errore AI dice di chiudere la foto con "${l.closeImageTitle}"`, true, !!l.closeImageTitle && avviso.includes(l.closeImageTitle));
    dice(`[${codice}] l'errore AI non manda nel cestino ("${l.moveToTrash}")`, false, !!l.moveToTrash && avviso.includes(l.moveToTrash));
}

process.exit(esito());
