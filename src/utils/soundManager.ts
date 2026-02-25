/**
 * SOUND MANAGER
 * Handles the synthesis and playback of UI sound effects (pops, clicks, chimes)
 * using the Web Audio API.
 */
class SoundManager {
    audioCtx: AudioContext | null = null;
    enabled: boolean = true;

    init() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
    }

    playTone(frequency: number, type: OscillatorType, duration: number, vol = 0.1) {
        if (!this.enabled) return;
        this.init();
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);
        gainNode.gain.setValueAtTime(vol, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        oscillator.start();
        oscillator.stop(this.audioCtx.currentTime + duration);
    }

    pop() { this.playTone(600, 'sine', 0.1, 0.1); }
    click() { this.playTone(300, 'square', 0.05, 0.05); }
    chime() {
        this.playTone(523.25, 'sine', 0.2, 0.1);
        setTimeout(() => this.playTone(659.25, 'sine', 0.3, 0.1), 100);
        setTimeout(() => this.playTone(783.99, 'sine', 0.4, 0.1), 200);
    }
}

export const soundManager = new SoundManager();
