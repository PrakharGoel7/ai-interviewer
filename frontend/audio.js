class AudioManager {
  constructor() {
    this.queue = Promise.resolve();
  }

  play(text) {
    this.queue = this.queue.then(() => this._playInternal(text));
    return this.queue;
  }

  async _playInternal(text) {
    const resp = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      throw new Error("TTS request failed");
    }
    const data = await resp.json();
    const audio = new Audio(`data:${data.mime};base64,${data.audio_base64}`);
    await new Promise((resolve) => {
      audio.onended = resolve;
      audio.onerror = resolve;
      audio.play();
    });
  }
}

window.audioManager = new AudioManager();
