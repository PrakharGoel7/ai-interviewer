import os
import shutil
import tempfile
import platform
import subprocess
import threading
import time
from dataclasses import dataclass
from typing import Optional

from openai import OpenAI

try:
    import sounddevice as sd  # type: ignore
    import numpy as np  # type: ignore
except ImportError:  # pragma: no cover - optional dependency
    sd = None  # type: ignore
    np = None  # type: ignore


class VoiceInterface:
    """Base interface for talking to the user via voice."""

    def speak(self, text: str) -> None:
        raise NotImplementedError

    def listen(self, prompt: str = "Speak now...") -> str:
        raise NotImplementedError


@dataclass
class OpenAIVoiceConfig:
    tts_model: str = "gpt-4o-mini-tts"
    stt_model: str = "gpt-4o-mini-transcribe"
    voice: str = "alloy"
    sample_rate: int = 16000
    max_seconds: int = 12
    silence_threshold: float = 0.01
    silence_duration: float = 1.0
    max_retries: int = 2


class VoiceRecorder:
    """Streams audio from the microphone and stops when silence is detected."""

    def __init__(self, sample_rate: int, silence_threshold: float, silence_duration: float):
        self.sample_rate = sample_rate
        self.silence_threshold = silence_threshold
        self.silence_duration = silence_duration
        self._frames = []
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._last_sound_time = None
        self._heard_sound = False

    def record(self, max_seconds: int) -> "np.ndarray":
        if sd is None or np is None:
            raise RuntimeError("sounddevice is required for voice recording.")
        self._frames = []
        self._stop_event.clear()
        self._heard_sound = False
        self._last_sound_time = None
        start_time = time.time()

        def callback(indata, frames, time_info, status):  # pragma: no cover - called by sounddevice
            rms = float(np.sqrt(np.mean(indata**2)))
            now = time.time()
            with self._lock:
                self._frames.append(indata.copy())
                if rms > self.silence_threshold:
                    self._heard_sound = True
                    self._last_sound_time = now

        try:
            with sd.InputStream(samplerate=self.sample_rate, channels=1, callback=callback):
                while not self._stop_event.is_set():
                    now = time.time()
                    if now - start_time >= max_seconds:
                        break
                    if self._heard_sound and self._last_sound_time and (now - self._last_sound_time) >= self.silence_duration:
                        break
                    time.sleep(0.1)
        except Exception as exc:
            print(f"⚠️  Audio recording failed: {exc}")
            return np.array([], dtype="float32")

        with self._lock:
            if not self._frames:
                return np.array([], dtype="float32")
            audio = np.concatenate(self._frames, axis=0).flatten()
            self._frames = []
        return audio

    def stop(self) -> None:
        self._stop_event.set()


class OpenAIVoiceInterface(VoiceInterface):
    """Voice interface powered by OpenAI speech APIs."""

    def __init__(self, client: OpenAI, config: Optional[OpenAIVoiceConfig] = None):
        if sd is None or np is None:
            raise RuntimeError("sounddevice + numpy are required for OpenAI voice mode. Install them before enabling.")
        self.client = client
        self.config = config or OpenAIVoiceConfig()
        self.recorder = VoiceRecorder(self.config.sample_rate, self.config.silence_threshold, self.config.silence_duration)

    def speak(self, text: str) -> None:
        if not text:
            return
        resp = self.client.audio.speech.create(
            model=self.config.tts_model,
            voice=self.config.voice,
            input=text,
        )
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp.write(resp.read())
            tmp_path = tmp.name
        self._play_audio(tmp_path)
        os.unlink(tmp_path)

    def listen(self, prompt: str = "Speak now...") -> str:
        print(f"\n🎙️  {prompt}")
        retries = max(1, self.config.max_retries)
        for attempt in range(1, retries + 1):
            print(f"(Listening attempt {attempt}/{retries}, up to {self.config.max_seconds}s)")
            audio = self.recorder.record(self.config.max_seconds)
            if audio.size == 0:
                print("⚠️  No audio captured. Retrying..." if attempt < retries else "⚠️  No audio captured.")
                continue
            text = self._transcribe_audio(audio)
            if text:
                return text
            print("⚠️  Transcription empty. Retrying..." if attempt < retries else "⚠️  Transcription empty.")
        return ""

    def _transcribe_audio(self, audio: "np.ndarray") -> str:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            self._write_wav(tmp, audio)
            tmp_path = tmp.name
        try:
            with open(tmp_path, "rb") as f:
                resp = self.client.audio.transcriptions.create(
                    model=self.config.stt_model,
                    file=f,
                )
        finally:
            os.unlink(tmp_path)
        return getattr(resp, "text", "").strip()

    def _write_wav(self, tmp, audio):
        import wave

        audio_data = (audio * 32767).astype(np.int16)  # type: ignore
        with wave.open(tmp, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(self.config.sample_rate)
            wf.writeframes(audio_data.tobytes())

    def _play_audio(self, path: str) -> None:
        player = self._detect_player()
        if player:
            subprocess.run([player, path], check=False)
            return
        try:
            import simpleaudio as sa  # type: ignore

            wave_obj = sa.WaveObject.from_wave_file(path)
            play_obj = wave_obj.play()
            play_obj.wait_done()
            return
        except Exception:
            pass
        print("⚠️  Unable to auto-play audio. File saved at:", path)

    def _detect_player(self) -> Optional[str]:
        system = platform.system().lower()
        if system == "darwin" and shutil.which("afplay"):
            return "afplay"
        if system == "linux" and shutil.which("aplay"):
            return "aplay"
        if shutil.which("ffplay"):
            return "ffplay"
        return None


def create_voice_interface(client: OpenAI, *, max_seconds: int = 12) -> VoiceInterface:
    if client is None:
        raise RuntimeError("OpenAI client is required for voice mode.")
    return OpenAIVoiceInterface(client, OpenAIVoiceConfig(max_seconds=max_seconds))
