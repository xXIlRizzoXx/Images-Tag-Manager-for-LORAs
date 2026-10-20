/* ITALIANO: PROVA: LE RICHIESTE AI CANALI DEI .txt SI SERVONO NELL'ORDINE DI ARRIVO
   Da quando i canali dei .txt sono asincroni la finestra resta usabile durante un "Salva" lungo: si puo'
   aprire una foto e premere "Salva .txt" nel visualizzatore mentre il lotto gira. Senza coda le due
   richieste si accavallavano: il visualizzatore scriveva il tag nuovo, poi il lotto arrivava alla stessa
   foto e ci riscriveva quello vecchio, dopo un "salvato". Ora una coda unica serve le richieste
   nell'ordine di arrivo, come quando i canali erano sincroni: vince l'ultima.
   Uso:  node scripts/test-sidecar-queue.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: THE REQUESTS TO THE .txt CHANNELS ARE SERVED IN ARRIVAL ORDER
   Since the .txt channels are asynchronous the window stays usable during a long "Save": a photo can be
   opened and "Save .txt" pressed in the viewer while the batch runs. With no queue the two requests
   overlapped: the viewer wrote the new tag, then the batch reached the same photo and wrote the old one
   back, after a "saved". Now a single queue serves the requests in arrival order, as when the channels
   were synchronous: the last one wins.
   Usage:  node scripts/test-sidecar-queue.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { caricaMain, creaControlli } from './main-harness.mjs';

const { handlers } = caricaMain();
const { dice, esito } = creaControlli();
const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-coda-'));
let codice = 1;
try {
    const foto = Array.from({ length: 300 }, (_, i) => path.join(cartella, `f${i}.png`));
    for (const f of foto) fs.writeFileSync(f, Buffer.from([137, 80, 78, 71]));
    const x = foto[foto.length - 1];
    const scrivi = handlers.get('images:write-sidecar-tags');
    // ITALIANO: il lotto (arrivato prima) contiene X con i tag vecchi; il visualizzatore (arrivato dopo) scrive X nuovo.
    // ENGLISH: the batch (arrived first) holds X with the old tags; the viewer (arrived later) writes the new X.
    const lotto = scrivi(null, foto.map(f => ({ imagePath: f, content: f === x ? 'ohwx, red hair,' : 'ohwx,' })));
    const visore = scrivi(null, [{ imagePath: x, content: 'ohwx, blue hair,' }]);
    const [rl, rv] = await Promise.all([lotto, visore]);
    dice('tutte e due le richieste riuscite', [true, true], [rl.ok, rv.ok]);
    dice('sul disco resta il testo dell\'ultima richiesta arrivata', 'ohwx, blue hair,', fs.readFileSync(x.replace(/\.png$/, '.txt'), 'utf8'));
    // ITALIANO: una lettura arrivata dopo una scrittura vede il testo scritto.
    // ENGLISH: a read that arrived after a write sees the written text.
    const s = scrivi(null, [{ imagePath: foto[0], content: 'nuovo,' }]);
    const l = handlers.get('images:read-sidecar-tags')(null, [foto[0]]);
    await s;
    dice('la lettura arrivata dopo vede la scrittura', 'nuovo,', ((await l)[0] || {}).content);
    // ITALIANO: un errore in una richiesta non blocca la coda.
    // ENGLISH: an error in one request does not block the queue.
    await scrivi(null, null);
    const dopo = await scrivi(null, [{ imagePath: foto[1], content: 'dopo,' }]);
    dice('dopo una richiesta sbagliata la coda va avanti', true, dopo.ok);
    codice = esito();
} finally {
    fs.rmSync(cartella, { recursive: true, force: true });
}
process.exit(codice);
