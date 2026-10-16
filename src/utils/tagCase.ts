/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: TAG UGUALI A PARTE LE MAIUSCOLE                                 **
**  Regola pura, senza React. Sta fuori dai componenti perche' le prove la    **
**  possano eseguire da sola.                                                 **
**                                                                            **
**  ENGLISH: TAGS THAT ARE THE SAME APART FROM CASE                           **
**  Pure rule, no React. It lives outside the components so the tests can     **
**  run it on its own.                                                        **
**                                                                            **
*******************************************************************************
*******************************************************************************/

// ITALIANO: "smile" e "Smile" sono lo stesso tag per chi addestra (il tokenizer di CLIP abbassa le
//   maiuscole): sulla stessa foto erano due tag, e il .txt usciva "smile, Smile,". Qui si confronta
//   senza badare alle maiuscole, ma NON si cambia la grafia di niente: una trigger "OHWX" o un tag
//   "Eiffel Tower" restano come sono stati scritti.
// ENGLISH: "smile" and "Smile" are the same tag for trainers (the CLIP tokenizer lowercases): on
//   the same photo they were two tags, and the .txt came out "smile, Smile,". Here tags are
//   compared regardless of case, but the spelling of nothing is changed: a trigger "OHWX" or a tag
//   "Eiffel Tower" stay as they were written.
const chiave = (tag: string): string => String(tag).toLowerCase();

// ITALIANO: il tag c'e' gia' nell'elenco, con questa o un'altra grafia?
// ENGLISH: is the tag already in the list, with this or another spelling?
export const hasTagIgnoringCase = (tags: string[], tag: string): boolean => {
    const k = chiave(tag);
    return tags.some(x => chiave(x) === k);
};

// ITALIANO: l'elenco senza doppioni a parte le maiuscole: di ogni tag resta la PRIMA grafia, cioe'
//   quella che la foto aveva gia'. Le grafie in `preferred` (le trigger word) vincono sempre: una
//   trigger deve restare scritta come nel suo riquadro, o non verrebbe piu' messa davanti.
// ENGLISH: the list without duplicates apart from case: each tag keeps its FIRST spelling, i.e.
//   the one the photo already had. The spellings in `preferred` (the trigger words) always win: a
//   trigger must stay written as in its box, or it would no longer be put first.
export const uniqueTagsIgnoringCase = (tags: string[], preferred: string[] = []): string[] => {
    const scelte = new Map<string, string>();
    for (const p of preferred) if (!scelte.has(chiave(p))) scelte.set(chiave(p), p);
    const visti = new Set<string>();
    const fuori: string[] = [];
    for (const tag of tags) {
        const k = chiave(tag);
        if (visti.has(k)) continue;
        visti.add(k);
        fuori.push(scelte.get(k) ?? tag);
    }
    return fuori;
};

// ITALIANO: quanti tag di `incoming` mancano davvero in `base`, a parte le maiuscole: e' il numero
//   che la foto riceve, perche' updateImageTags scarta i doppioni con la regola qui sopra. Prima
//   l'AI (che scrive tutto in minuscolo) contava "smile" come nuovo su una foto con "Smile", e
//   "Tag generati" diceva un numero piu' alto dei tag comparsi. Non va mai sotto zero, anche se
//   `base` ha gia' dei doppioni (un .txt importato con "smile, Smile").
// ENGLISH: how many tags of `incoming` are really missing from `base`, apart from case: it is the
//   number the photo gets, because updateImageTags drops duplicates with the rule above. The AI
//   (which writes everything lowercase) used to count "smile" as new on a photo with "Smile", and
//   "Tags generated" said a higher number than the tags that appeared. It never goes below zero,
//   even if `base` already holds duplicates (an imported .txt with "smile, Smile").
export const countNewTagsIgnoringCase = (base: string[], incoming: string[]): number =>
    uniqueTagsIgnoringCase(incoming).filter(tag => !hasTagIgnoringCase(base, tag)).length;

// ITALIANO: la foto ha almeno un tag che NON e' una trigger word? E' la domanda di "Salta foto gia'
//   taggate": la trigger ("ohwx") sta sulle foto ma non le descrive. Contandola, con una trigger
//   impostata (il flusso normale: prima la trigger, poi l'AI) ogni foto risultava gia' taggata e
//   "Tagga tutte con AI" le saltava tutte, senza mandarne nessuna. Confronto senza maiuscole.
// ENGLISH: does the photo have at least one tag that is NOT a trigger word? It is the question
//   behind "Skip already-tagged photos": the trigger ("ohwx") sits on the photos but does not
//   describe them. Counting it, with a trigger set (the normal flow: trigger first, then the AI)
//   every photo looked already tagged and "Auto-tag all with AI" skipped them all, sending none.
//   Compared regardless of case.
export const hasTagsBeyondTriggers = (tags: string[], triggers: string[]): boolean =>
    tags.some(tag => !hasTagIgnoringCase(triggers, tag));

// ITALIANO: il testo scritto o incollato in un campo che aggiunge tag, diviso su virgole e a capo,
//   senza vuoti e senza doppioni (a parte le maiuscole). Un elenco "1girl, solo, smile" incollato
//   nel visualizzatore o nel pannello in blocco diventava UN tag con le virgole dentro: il .txt usciva
//   con dei doppioni ("smile, smile,") e al caricamento dopo tornavano tag diversi. Il campo delle
//   card (TagInput) divideva gia' cosi'.
// ENGLISH: the text typed or pasted into a field that adds tags, split on commas and line breaks,
//   with no empties and no duplicates (apart from case). A list "1girl, solo, smile" pasted into the
//   viewer or the bulk panel became ONE tag with the commas inside: the .txt came out with duplicates
//   ("smile, smile,") and the next load brought back different tags. The cards' field (TagInput)
//   already split this way.
export const splitTagInput = (testo: string): string[] =>
    uniqueTagsIgnoringCase(String(testo || '').split(/[,\n\r]+/).map(tag => tag.trim()).filter(tag => tag.length > 0));
