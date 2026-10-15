/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: RETE DI SICUREZZA PER GLI ERRORI                                **
**  Cattura gli errori imprevisti dei componenti React mostrando una          **
**  schermata di recupero al posto di una pagina bianca.                      **
**                                                                            **
**  ENGLISH: ERROR SAFETY NET                                                 **
**  Catches unexpected React component errors and shows a recovery screen     **
**  instead of a blank page.                                                  **
**                                                                            **
*******************************************************************************
*******************************************************************************/
import { Component, ErrorInfo, ReactNode } from 'react';
import { translations } from '../constants';

// ITALIANO: Questa schermata e' un componente di classe e non riceve le traduzioni
//           dall'app (che a quel punto e' andata in errore). Leggo quindi la lingua
//           salvata direttamente, ripiegando sull'inglese se manca o e' illeggibile.
//           Prima i testi erano scritti a mano in italiano: comparivano in italiano
//           anche con l'app in giapponese o russo.
// ENGLISH: This screen is a class component and does not receive the translations from
//          the app (which has just crashed). So it reads the saved language directly,
//          falling back to English if missing or unreadable. The texts used to be
//          hardcoded in Italian, showing up in Italian even in a Japanese or Russian UI.
// ITALIANO: il tipo e' quello del blocco inglese: senza, `s` era any e una chiave scritta male
//           (s.errorBoundaryTitel) passava il compilatore e il controllo delle lingue, e il testo
//           usciva vuoto in tutte le lingue.
// ENGLISH: the type is the English block's: without it `s` was any and a misspelled key
//          (s.errorBoundaryTitel) passed the compiler and the language check, and the text came out
//          blank in every language.
const getStrings = (): typeof translations.en => {
    try {
        const lang = localStorage.getItem('lang') || 'en';
        return ((translations as any)[lang] || translations.en) as typeof translations.en;
    } catch (_) {
        return translations.en;
    }
};

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('Unhandled UI error:', error, errorInfo);
    }

    handleReset = (): void => {
        this.setState({ hasError: false, error: null });
    };

    handleReload = (): void => {
        window.location.reload();
    };

    render(): ReactNode {
        if (!this.state.hasError) return this.props.children;

        const message = this.state.error?.message || 'Unknown error';
        const s = getStrings();
        return (
            <div
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
                    color: '#e5e7eb',
                }}
            >
                <div
                    style={{
                        maxWidth: 480,
                        padding: '2rem',
                        borderRadius: 16,
                        background: 'rgba(17, 24, 39, 0.8)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
                    }}
                >
                    <h1 style={{ margin: '0 0 0.5rem 0', fontSize: 22, fontWeight: 800, color: '#fff' }}>
                        {s.errorBoundaryTitle}
                    </h1>
                    <p style={{ margin: '0 0 1rem 0', fontSize: 14, color: '#cbd5e1' }}>
                        {s.errorBoundaryBody}
                    </p>
                    <pre
                        style={{
                            fontSize: 12,
                            background: 'rgba(0,0,0,0.4)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            padding: '0.75rem',
                            borderRadius: 8,
                            overflow: 'auto',
                            maxHeight: 160,
                            color: '#fca5a5',
                            margin: '0 0 1.25rem 0',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                        }}
                    >
                        {message}
                    </pre>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={this.handleReset}
                            style={{
                                flex: 1,
                                padding: '0.6rem 1rem',
                                borderRadius: 8,
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.06)',
                                color: '#e5e7eb',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            {s.errorBoundaryRetry}
                        </button>
                        <button
                            onClick={this.handleReload}
                            style={{
                                flex: 1,
                                padding: '0.6rem 1rem',
                                borderRadius: 8,
                                border: 'none',
                                background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                                color: '#fff',
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            {s.errorBoundaryReload}
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
