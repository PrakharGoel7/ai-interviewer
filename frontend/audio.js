class AudioManager {
  constructor() {
    this.queue = Promise.resolve();
    this.ttsEnabled = true;
  }

  play(text) {
    if (!this.ttsEnabled) {
      return Promise.reject(new Error("TTS disabled"));
    }
    this.queue = this.queue.then(() => this._playInternal(text));
    return this.queue;
  }

  async _playInternal(text) {
    let resp;
    try {
      resp = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    } catch (err) {
      this.ttsEnabled = false;
      throw new Error("TTS disabled");
    }
    if (!resp.ok) {
      this.ttsEnabled = false;
      throw new Error("TTS disabled");
    }
    const data = await resp.json();
    const audio = new Audio(`data:${data.mime};base64,${data.audio_base64}`);
    await new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
      };
      audio.onended = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      audio.onerror = (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err instanceof Event ? new Error("Audio playback failed") : err || new Error("Audio playback failed"));
      };
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((err) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(err || new Error("Audio playback blocked"));
        });
      }
    });
  }
}

window.audioManager = new AudioManager();
