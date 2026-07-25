/******************************************************************************
**  ITALIANO: BANDIERE LOCALI (offline, nessuna richiesta di rete)            **
**  Prima le bandiere venivano scaricate da https://flagcdn.com a ogni avvio: **
**  senza internet apparivano rotte e, con internet, l'app "chiamava" un sito **
**  esterno (una piccola fuga di privacy per un programma pensato offline).   **
**  Qui ogni bandiera e' un piccolo SVG incorporato: niente rete, niente CDN. **
**                                                                            **
**  ENGLISH: LOCAL FLAGS (offline, no network request)                        **
**  Flags used to be downloaded from https://flagcdn.com on every launch: with **
**  no internet they showed broken and, with internet, the app "phoned" an     **
**  external site (a small privacy leak for an offline-minded program). Here    **
**  each flag is a tiny embedded SVG: no network, no CDN.                       **
******************************************************************************/

// ITALIANO: bandiere semplificate ma riconoscibili, ritagliate a cerchio dall'interfaccia.
// ENGLISH: simplified but recognizable flags, cropped to a circle by the UI.
const SVG: Record<string, string> = {
    // Italia — verde/bianco/rosso verticale
    it: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 2'><rect width='3' height='2' fill='#fff'/><rect width='1' height='2' fill='#009246'/><rect width='1' height='2' x='2' fill='#ce2b37'/></svg>`,
    // Regno Unito — Union Jack
    gb: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 30'><clipPath id='t'><path d='M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z'/></clipPath><rect width='60' height='30' fill='#012169'/><path d='M0,0 L60,30 M60,0 L0,30' stroke='#fff' stroke-width='6'/><path d='M0,0 L60,30 M60,0 L0,30' clip-path='url(#t)' stroke='#c8102e' stroke-width='4'/><path d='M30,0 v30 M0,15 h60' stroke='#fff' stroke-width='10'/><path d='M30,0 v30 M0,15 h60' stroke='#c8102e' stroke-width='6'/></svg>`,
    // Francia — blu/bianco/rosso verticale
    fr: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 2'><rect width='3' height='2' fill='#fff'/><rect width='1' height='2' fill='#0055a4'/><rect width='1' height='2' x='2' fill='#ef4135'/></svg>`,
    // Spagna — rosso/giallo(doppio)/rosso orizzontale
    es: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'><rect width='4' height='3' fill='#aa151b'/><rect width='4' height='1.5' y='0.75' fill='#f1bf00'/></svg>`,
    // Germania — nero/rosso/oro orizzontale
    de: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 3'><rect width='3' height='3' fill='#ffce00'/><rect width='3' height='2' fill='#d00'/><rect width='3' height='1' fill='#000'/></svg>`,
    // Cina — rosso con stella gialla
    cn: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 20'><rect width='30' height='20' fill='#de2910'/><g fill='#ffde00'><path d='M8,3 L9.18,6.6 L6.1,4.38 L9.9,4.38 L6.82,6.6 Z'/></g></svg>`,
    // Giappone — bianco con cerchio rosso
    jp: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 2'><rect width='3' height='2' fill='#fff'/><circle cx='1.5' cy='1' r='0.6' fill='#bc002d'/></svg>`,
    // Brasile — verde, rombo giallo, cerchio blu
    br: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 20'><rect width='30' height='20' fill='#009b3a'/><path d='M15,3 L27,10 L15,17 L3,10 Z' fill='#fedf00'/><circle cx='15' cy='10' r='4' fill='#002776'/></svg>`,
    // Russia — bianco/blu/rosso orizzontale
    ru: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 3'><rect width='3' height='3' fill='#d52b1e'/><rect width='3' height='2' fill='#0039a6'/><rect width='3' height='1' fill='#fff'/></svg>`,
};

// ITALIANO: dalla lingua alla bandiera (en->gb, zh->cn, ja->jp, pt->br); altrimenti codice = lingua.
// ENGLISH: language to flag (en->gb, zh->cn, ja->jp, pt->br); otherwise the code equals the language.
const LANG_TO_FLAG: Record<string, string> = { en: 'gb', zh: 'cn', ja: 'jp', pt: 'br' };

const toDataUri = (svg: string): string =>
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

// ITALIANO: bandiera a partire dal codice paese (it, gb, fr...). Riserva: quadrato grigio.
// ENGLISH: flag from a country code (it, gb, fr...). Fallback: a grey square.
export const flagUri = (countryCode: string): string => {
    const svg = SVG[countryCode] || `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 2'><rect width='3' height='2' fill='#9ca3af'/></svg>`;
    return toDataUri(svg);
};

// ITALIANO: bandiera a partire dal codice lingua (it, en, fr...).
// ENGLISH: flag from a language code (it, en, fr...).
export const flagUriForLang = (langCode: string): string =>
    flagUri(LANG_TO_FLAG[langCode] || langCode);
