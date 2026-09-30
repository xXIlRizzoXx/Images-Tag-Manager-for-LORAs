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
