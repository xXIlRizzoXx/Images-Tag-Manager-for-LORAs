/* ITALIANO: PROVA DEL RIPRISTINO DAL BACKUP ANTI-CRASH CON LE TRIGGER WORD ATTIVE
   Le trigger word non si ricordano fra una sessione e l'altra, e il loro riquadro si puo' riempire
   prima di aprire la cartella. Dopo un crash, con la trigger "ohwx" scritta prima dell'import, le
   foto senza backup la ricevevano davanti ai loro tag, ma quelle con modifiche recuperate dal
   backup no: il ripristino teneva solo le trigger che c'erano gia' nel backup. "Salva" scriveva i
   loro .txt senza la trigger che il riquadro mostrava attiva per tutto il progetto.
   Si provano le regole VERE di src/utils/tagBackup.ts e src/utils/sidecarTags.ts (compilate al volo
   con esbuild), con lo stesso giro del programma: backup scritto -> crash -> trigger scritta ->
   import (tagDiImport, poi tagDaRipristinare).
   Uso:  node scripts/test-backup-restore-triggers.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE CRASH-BACKUP RESTORE WITH TRIGGER WORDS ACTIVE
   Trigger words are not remembered between sessions, and their box can be filled before the folder
   is opened. After a crash, with the trigger "ohwx" typed before the import, photos with no backup
   got it in front of their tags, but those with edits recovered from the backup did not: the
   restore kept only the triggers already in the backup. "Save" wrote their .txt without the trigger
   the box showed as active for the whole project.
   The REAL rules of src/utils/tagBackup.ts and src/utils/sidecarTags.ts are tested (compiled on the
   fly with esbuild), along the program's own loop: backup written -> crash -> trigger typed ->
   import (tagDiImport, then tagDaRipristinare).
   Usage:  node scripts/test-backup-restore-triggers.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const B = await carica('src/utils/tagBackup.ts');
const S = await carica('src/utils/sidecarTags.ts');
const { dice, esito } = creaControlli();

const SEP = '\x1f';
const nomi = ['a.png', 'b.png'];
// ITALIANO: una foto come la crea l'import (cartella "dataset", un solo lotto).
// ENGLISH: a photo as the import creates it (folder "dataset", a single batch).
const foto = (nome, tags, originalTags) => ({
    id: nome, file: { name: nome }, tags, originalTags, backupKey: 'dataset' + SEP + nome,
    lottoImport: 'L1', cartellaImport: 'dataset',
});
// ITALIANO: sessione 1: a.png ha "smile" su disco e l'utente aggiunge "blue eyes" senza salvare.
//           Ritorna il backup come lo lascia l'effetto di App.tsx prima del crash.
// ENGLISH: session 1: a.png has "smile" on disk and the user adds "blue eyes" without saving.
//          Returns the backup as App.tsx's effect leaves it before the crash.
const crash = (tagsA, discoA = ['smile']) => {
    const b = B.costruisciBackup([foto('a.png', tagsA, discoA), foto('b.png', ['smile'], ['smile'])], [], 'dataset');
    return b ? JSON.stringify({ ts: Date.now(), ...b }) : null;
};
// ITALIANO: sessione 2: l'import di una foto con le trigger `trig` attive, come processImportData.
// ENGLISH: session 2: one photo's import with the triggers `trig` active, as processImportData does.
const importa = (salvato, nome, disco, trig) => {
    const letto = B.backupDellImport(salvato, 'dataset', B.folderSignature('dataset', nomi));
    const voce = letto ? letto.voci['dataset' + SEP + nome] : undefined;
    const imp = S.tagDiImport(trig, disco);
    const ripristinati = B.tagDaRipristinare(voce, imp.tags, imp.originalTags, trig, undefined, letto ? letto.ts : null);
    return { tags: ripristinati || imp.tags, ripristinata: Boolean(ripristinati), originalTags: imp.originalTags };
};

console.log('\n--- crash, poi la trigger "ohwx" scritta prima di riaprire la cartella ---');
{
    const salvato = crash(['smile', 'blue eyes']);
    const a = importa(salvato, 'a.png', ['smile'], ['ohwx']);
    const b = importa(salvato, 'b.png', ['smile'], ['ohwx']);
    dice('a.png (dal backup): la trigger davanti, poi le modifiche recuperate', ['ohwx', 'smile', 'blue eyes'], a.tags);
    dice('a.png conta come recuperata', true, a.ripristinata);
    dice('b.png (senza backup): la trigger davanti, come prima', ['ohwx', 'smile'], b.tags);
}

console.log('\n--- un backup uguale al disco: la sola trigger in piu\' non e\' un recupero ---');
{
    // ITALIANO: una voce senza `base` (versione precedente, che teneva anche le foto senza modifiche).
    // ENGLISH: an entry with no `base` (previous version, which also held unedited photos).
    const r = B.tagDaRipristinare({ tags: ['smile'] }, ['ohwx', 'smile'], ['smile'], ['ohwx'], 0, Date.now());
    dice('niente da rimettere: restano i tag dell\'import, con la trigger', null, r);
}

console.log('\n--- il backup ha gia\' la trigger ---');
{
    const salvato = crash(['ohwx', 'smile', 'blue eyes']);
    const a = importa(salvato, 'a.png', ['smile'], ['ohwx']);
    dice('la trigger una volta sola, davanti', ['ohwx', 'smile', 'blue eyes'], a.tags);
    const maiuscola = importa(crash(['OHWX', 'smile', 'blue eyes']), 'a.png', ['smile'], ['ohwx']);
    dice('anche con un\'altra grafia nel backup: una sola, con la grafia del riquadro', ['ohwx', 'smile', 'blue eyes'], maiuscola.tags);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const salvato = crash(['smile', 'blue eyes']);
    const a = importa(salvato, 'a.png', ['smile'], []);
    dice('nessuna trigger attiva: tornano le modifiche, come prima', ['smile', 'blue eyes'], a.tags);
    const due = importa(crash(['beta', 'smile', 'blue eyes']), 'a.png', ['smile'], ['alfa', 'beta']);
    dice('due trigger: tutte e due davanti, nell\'ordine del riquadro', ['alfa', 'beta', 'smile', 'blue eyes'], due.tags);
    // ITALIANO: il .txt e' cambiato dopo il backup: vince il disco anche con la trigger attiva.
    // ENGLISH: the .txt changed after the backup: the disk wins with the trigger active too.
    const cambiato = importa(salvato, 'a.png', ['smile', 'hat'], ['ohwx']);
    dice('.txt cambiato dopo il backup: restano i tag del .txt, con la trigger', [['ohwx', 'smile', 'hat'], false], [cambiato.tags, cambiato.ripristinata]);
}

process.exit(esito());
