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

// ITALIANO: Nomi delle CATEGORIE gia' tradotti nel dizionario dei Tag Suggeriti (27 su 31).
// ENGLISH: CATEGORY names already translated in the Suggested Tags dictionary (27 of 31).
const categoryNames = new Map<string, Record<string, string>>();
for (const category of suggestedTagsData) categoryNames.set(category.id, category.name);

/**
 * ITALIANO: Nome leggibile di una categoria di tag nella lingua scelta, per le etichette
 *   del grafico a torta delle statistiche (prima si vedeva l'identificativo grezzo, tipo
 *   "face_details"). Le 4 categorie assenti dal dizionario (personaggi, colori, +18,
 *   generici) arrivano dalle traduzioni dell'app, passate qui come `t`.
 * ENGLISH: Human-readable name of a tag category in the chosen language, for the statistics
 *   pie-chart labels (they used to show the raw id, e.g. "face_details"). The 4 categories
 *   missing from the dictionary (characters, colours, adult, general) come from the app
 *   translations, passed in as `t`.
 */
// ITALIANO: il dizionario dei Tag Suggeriti e' tradotto SOLO in italiano e inglese. Per le altre
//           7 lingue i 27 nomi di categoria del dizionario ripiegano sull'inglese: se le 4
//           categorie dell'app (personaggi/colori/+18/generici) restassero tradotte, la torta
//           mostrerebbe DUE lingue nello stesso grafico (es. tedesco + inglese). Percio' fuori da
//           it/en mostro TUTTA la torta in inglese: un solo idioma, coerente.
// ENGLISH: the Suggested Tags dictionary is translated ONLY into Italian and English. For the
//          other 7 languages the 27 dictionary category names fall back to English; if the 4
//          app categories (characters/colors/+18/general) stayed localized, the pie would show
//          TWO languages in one chart. So outside it/en I render the WHOLE pie in English: one
//          consistent language.
const DICTIONARY_LANGS = new Set(['it', 'en']);
const extraCategoryEnglish: Record<string, string> = {
    characters: 'Characters',
    colors: 'Colors',
    nsfw: 'Adult (+18)',
    general: 'General',
};

export const translateCategory = (categoryId: string, lang: string, t: any): string => {
    const localized: Record<string, string> = {
        characters: t?.catCharacters,
        colors: t?.catColors,
        nsfw: t?.catNsfw,
        general: t?.catGeneral,
    };
    if (categoryId in extraCategoryEnglish) {
        if (DICTIONARY_LANGS.has(lang) && localized[categoryId]) return localized[categoryId];
        return extraCategoryEnglish[categoryId];
    }
    const names = categoryNames.get(categoryId);
    if (names) return names[lang] || names.en || categoryId;
    return categoryId;
};
