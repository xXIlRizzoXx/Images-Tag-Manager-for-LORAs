import { useRef } from 'react';

// ITALIANO: chiusura di una finestra con un clic sullo sfondo scuro, ma SOLO se anche la pressione
//           del mouse e' partita dallo sfondo. Chromium manda il click all'antenato comune dei due
//           elementi di pressione e rilascio: premendo dentro (per esempio per selezionare il testo
//           di una casella) e rilasciando sullo sfondo, il click arrivava allo sfondo e chiudeva la
//           finestra, con il testo scritto perso. La pressione si legge in fase di cattura, cosi'
//           nessun elemento interno la puo' fermare; si chiude al rilascio (click) come prima, quindi
//           il clic non passa a quello che c'e' sotto la finestra.
// ENGLISH: closing a window with a click on the dark backdrop, but ONLY if the mouse press also
//          started on the backdrop. Chromium sends the click to the common ancestor of the press
//          and release elements: pressing inside (e.g. to select the text of a field) and releasing
//          on the backdrop sent the click to the backdrop, which closed the window and lost the
//          typed text. The press is read in the capture phase, so no inner element can stop it; the
//          window still closes on release (click), so the click does not reach what lies beneath.
type EventoSfondo = { target: EventTarget | null; currentTarget: EventTarget | null };

export function gestoriSfondo(premuto: { current: boolean }, chiudi: () => void) {
    return {
        onMouseDownCapture: (e: EventoSfondo) => { premuto.current = e.target === e.currentTarget; },
        onClick: (e: EventoSfondo) => {
            const daSfondo = premuto.current;
            premuto.current = false;
            if (daSfondo && e.target === e.currentTarget) chiudi();
        },
    };
}

export function useChiusuraSfondo(chiudi: () => void) {
    const premuto = useRef(false);
    return gestoriSfondo(premuto, chiudi);
}
