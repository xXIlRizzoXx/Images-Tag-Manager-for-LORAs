/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: AVVISO DI FINE IMPORT                                           **
**  Regola pura, senza React: cosa dice il messaggio a comparsa quando le     **
**  foto sono state caricate. Sta fuori da App.tsx perche' le prove la        **
**  possano eseguire da sola.                                                 **
**                                                                            **
**  ENGLISH: END-OF-IMPORT NOTICE                                             **
**  Pure rule, no React: what the pop-up message says once the photos are     **
**  loaded. It lives outside App.tsx so the tests can run it on its own.      **
**                                                                            **
*******************************************************************************
*******************************************************************************/

type TestiAvviso = {
    successImport: string;
    importTxtShortened: string;
    importRestoredFromBackup: string;
    importTxtSkipped: string;
    importTxtSkippedNames: string;
};

// ITALIANO: Il messaggio e' fatto di FRASI INTERE, tradotte, unite da " · ". Prima alle foto
//   caricate si incollavano dei simboli ("· ↻ 3 · ⊘ 2 .txt") che nessuna lingua spiegava: l'utente
//   non poteva sapere che 3 foto avevano ripreso dal backup tag diversi dal loro .txt (e che
//   "Salva" li avrebbe scritti), ne' che 2 file di tag erano stati ignorati. Ogni frase e' nella
//   forma "etichetta: {n}", che si legge giusta anche con 1 in tutte le lingue.
//   Il messaggio e' UNO solo: showNotification sostituisce quello a schermo, non li mette in fila.
//   Se dei .txt sono stati accorciati, l'avviso d'errore prende il posto di "Immagini caricate",
//   come prima, e le altre frasi gli restano dietro.
// ENGLISH: The message is made of WHOLE translated SENTENCES joined by " · ". The loaded-photos
//   count used to get symbols glued on ("· ↻ 3 · ⊘ 2 .txt") that no language explained: the user
//   could not know that 3 photos had taken back from the backup tags different from their .txt (and
//   that "Save" would write them), nor that 2 tag files had been ignored. Each sentence has the
//   "label: {n}" form, which reads right with 1 too in every language.
//   There is ONE message only: showNotification replaces the one on screen, it does not queue.
//   If some .txt were shortened, the error warning takes the place of "Images loaded", as before,
//   and the other sentences follow it.
//   ITALIANO: con dei .txt saltati l'avviso non e' piu' verde di riuscita ma blu, e dice i primi tre
//   nomi (`nomiSaltati`): prima diceva solo quanti, e quelle foto sembravano senza tag senza modo di
//   sapere quali fossero.
//   ENGLISH: with skipped .txt files the notice is no longer a green success but blue, and names the
//   first three (`nomiSaltati`): it used to say only how many, and those photos looked untagged with
//   no way to find out which they were.
export const avvisoImport = (
    t: TestiAvviso,
    n: { caricate: number; ripristinate: number; saltati: number; accorciati: number; nomiSaltati?: string[] },
): { testo: string; tipo: 'success' | 'error' | 'info' } => {
    const parti = [n.accorciati > 0
        ? t.importTxtShortened.replace('{n}', String(n.accorciati))
        : t.successImport.replace('{n}', String(n.caricate))];
    if (n.ripristinate > 0) parti.push(t.importRestoredFromBackup.replace('{n}', String(n.ripristinate)));
    if (n.saltati > 0) parti.push(t.importTxtSkipped.replace('{n}', String(n.saltati)));
    const nomi = n.saltati > 0 && Array.isArray(n.nomiSaltati) ? n.nomiSaltati.filter(Boolean) : [];
    if (nomi.length > 0) parti.push(t.importTxtSkippedNames.replace('{names}', nomi.slice(0, 3).join(', ') + (nomi.length > 3 ? '…' : '')));
    return { testo: parti.join(' · '), tipo: n.accorciati > 0 ? 'error' : n.saltati > 0 ? 'info' : 'success' };
};
