/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private lastAnnouncementText: string = '';
  private lastAnnouncementTime: number = 0;
  private lastBeepTime: number = 0;

  // Initialize Audio Context on demand to satisfy browser interaction policies
  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Use Text-To-Speech (synth) to announce an obstacle.
   * Includes anti-flooding constraints to avoid speech overlaps or repeat spams.
   */
  public speak(
    text: string, 
    rate: number = 1.1, 
    cooldownMs: number = 3000, 
    force: boolean = false
  ) {
    const synth = window.speechSynthesis;
    if (!synth) return;

    const now = Date.now();
    const isSameText = text === this.lastAnnouncementText;
    const isWithinCooldown = (now - this.lastAnnouncementTime) < cooldownMs;

    // Prevent voice spamming unless forced
    if (!force && isSameText && isWithinCooldown) {
      return;
    }

    try {
      // Cancel active speaking to deliver immediate fresh hazards
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.max(0.6, Math.min(2.5, rate)); // bound between 0.6x and 2.5x
      utterance.volume = 1.0;

      // Select a high-quality human-like English voice, if available
      const voices = synth.getVoices();
      const englishVoice = voices.find(
        (voice) => voice.lang.startsWith('en') && voice.name.includes('Google')
      ) || voices.find(
        (voice) => voice.lang.startsWith('en')
      );
      
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      synth.speak(utterance);

      this.lastAnnouncementText = text;
      this.lastAnnouncementTime = now;
    } catch (e) {
      console.error('SpeechSynthesis error:', e);
    }
  }

  /**
   * Dynamic beep sound warning based on obstacle proximity.
   * As an item occupies more area of the view, beeps become more urgent.
   * @param distanceFactor value from 0 (far) to 1 (extremely close/hazard)
   */
  public triggerProximityBeep(distanceFactor: number) {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const systemNow = Date.now();

      // Control beep trigger rate based on proximity (closer = search rate is higher)
      // distanceFactor of 0.2 -> repeat beep every 800ms
      // distanceFactor of 0.8 -> repeat beep every 150ms
      const beepInterval = Math.max(120, 900 - (distanceFactor * 1000));
      
      if (systemNow - this.lastBeepTime < beepInterval) {
        return; // too soon for next beep rhythm
      }

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Pitch increases from 400Hz (far obstacle) to 900Hz (danger ahead)
      const frequency = 400 + (distanceFactor * 550);
      osc.frequency.setValueAtTime(frequency, now);

      // Beep style (shorter, punchier clicks for high urgency)
      const duration = Math.max(0.04, 0.15 - (distanceFactor * 0.1));
      
      osc.type = distanceFactor > 0.6 ? 'sawtooth' : 'sine'; // sawtooth is more harsh/warning-like when close

      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.15, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.start(now);
      osc.stop(now + duration + 0.05);

      this.lastBeepTime = systemNow;
    } catch (e) {
      console.error('AudioContext beep error:', e);
    }
  }

  /**
   * Stop all sound feedback
   */
  public stopAll() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}

export const audioEngine = new AudioEngine();
