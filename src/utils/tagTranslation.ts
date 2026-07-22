/******************************************************************************
**  ITALIANO: TRADUZIONE DEI TAG                                              **
**  I tag si scrivono in inglese (standard per il training LoRA). Questo file **
**  costruisce, una volta sola, una mappa "tag inglese -> traduzioni" a       **
**  partire dal dizionario dei Tag Suggeriti, cosi' nel visualizzatore, al    **
**  passaggio del mouse, si puo' mostrare la traduzione nella lingua scelta.  **
**                                                                            **
**  ENGLISH: TAG TRANSLATION                                                  **
**  Tags are written in English (LoRA training standard). This file builds,   **
**  once, a "english tag -> translations" map from the Suggested Tags         **
**  dictionary, so the viewer can show the translation in the chosen language **
**  on hover.                                                                 **
******************************************************************************/
import { suggestedTagsData } from '../constants/tagSuggestions';

const tagMap = new Map<string, Record<string, string>>();
for (const category of suggestedTagsData) {
    for (const tagObj of category.tags) {
        // ITALIANO: primo che vince — un tag puo' comparire in piu' categorie.
        // ENGLISH: first wins — a tag may appear in more than one category.
        if (!tagMap.has(tagObj.tag)) tagMap.set(tagObj.tag, tagObj.translations);
    }
}

/**
 * ITALIANO: Restituisce la traduzione del tag nella lingua richiesta, oppure null
 *   se non c'e' una traduzione utile (tag sconosciuto, o traduzione uguale al tag
 *   stesso in inglese: in quel caso il tooltip sarebbe inutile e non lo mostriamo).
 * ENGLISH: Returns the tag translation in the requested language, or null when
 *   there is no useful translation (unknown tag, or translation identical to the
 *   English tag: the tooltip would be pointless, so we skip it).
 */
export const translateTag = (tag: string, lang: string): string | null => {
    const translations = tagMap.get(tag);
    if (!translations) return null;
    const value = translations[lang];
    if (!value) return null;
    if (value.toLowerCase() === tag.toLowerCase()) return null;
    return value;
};
