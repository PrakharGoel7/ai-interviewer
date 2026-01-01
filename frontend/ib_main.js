const startBtn = document.getElementById("start-btn");
const productSelect = document.getElementById("product-select");
const industrySelect = document.getElementById("industry-select");
const recordBtn = document.getElementById("record-btn");
const voiceStatus = document.getElementById("voice-status");
const currentPromptEl = document.getElementById("current-prompt");
const repeatPromptBtn = document.getElementById("repeat-prompt-btn");
const timerEl = document.getElementById("recording-timer");
const voiceWaveform = document.getElementById("voice-waveform");
const loadingIndicator = document.getElementById("loading-indicator");
const loadingText = document.getElementById("loading-text");

let recognition = null;
let useSpeechRecognition = false;
let mediaRecorder = null;
let mediaStream = null;
let recordedChunks = [];
let isRecording = false;
let voiceEnabled = false;
let recordingInterval = null;
let recordingSeconds = 0;
let latestPromptText = "";
let micPermissionGranted = false;
let micPermissionDenied = false;
let audioCtx = null;
let analyser = null;
let silenceCheckInterval = null;
let lastSoundTimestamp = 0;
let loadingDepth = 0;
let interviewDone = false;
let ibReportRedirected = false;

const SILENCE_THRESHOLD = 0.02;
const SILENCE_DURATION_MS = 1500;

recordBtn.disabled = true;

async function api(path, options = {}) {
  const resp = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || "Request failed");
  }
  return resp.json();
}

function setPrompt(text) {
  if (text) {
    latestPromptText = text;
    currentPromptEl.textContent = text;
  }
}

function setLoading(active, message) {
  if (message) {
    loadingText.textContent = message;
  }
  if (active) {
    loadingDepth += 1;
    loadingIndicator.classList.remove("hidden");
  } else {
    loadingDepth = Math.max(0, loadingDepth - 1);
    if (loadingDepth === 0) {
      loadingIndicator.classList.add("hidden");
    }
  }
}

function speak(text) {
  if (!text) return;
  if (window.audioManager) {
    window.audioManager.play(text).catch(() => fallbackSpeak(text));
    return;
  }
  fallbackSpeak(text);
}

function fallbackSpeak(text) {
  if (!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function updateEvents(events) {
  if (!Array.isArray(events)) return;
  const lastInterviewer = [...events].reverse().find((evt) => evt.role === "interviewer");
  if (lastInterviewer) {
    setPrompt(lastInterviewer.text);
  }
}

function initSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    useSpeechRecognition = true;
    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.addEventListener("start", () => {
      isRecording = true;
      setVoiceStatus("Recording…");
      startTimer();
      voiceWaveform.classList.add("active");
      recordBtn.classList.add("recording");
      recordBtn.textContent = "Stop recording";
    });

    recognition.addEventListener("end", () => {
      isRecording = false;
      stopTimer();
      voiceWaveform.classList.remove("active");
      recordBtn.classList.remove("recording");
      recordBtn.textContent = "Start recording";
      setVoiceStatus(voiceEnabled ? "Mic ready" : "Mic inactive");
    });

    recognition.addEventListener("result", (event) => {
      const transcript = event.results[0][0].transcript.trim();
      if (transcript) {
        stopListening();
        sendResponse(transcript);
      }
    });

    recognition.addEventListener("error", () => {
      stopTimer();
      voiceWaveform.classList.remove("active");
      setVoiceStatus("Error. Try again.");
      recordBtn.classList.remove("recording");
      recordBtn.textContent = "Start recording";
    });
    return;
  }

  useSpeechRecognition = false;
}

function startListening() {
  if (!voiceEnabled || !recognition || isRecording) return;
  try {
    recognition.start();
  } catch (err) {}
}

function stopListening() {
  if (!recognition || !isRecording) return;
  recognition.stop();
}

async function startMediaRecording() {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    setVoiceStatus("Voice not supported");
    return;
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    setVoiceStatus("Mic permission denied");
    return;
  }
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(mediaStream);
  mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size > 0) recordedChunks.push(event.data);
  });
  mediaRecorder.addEventListener("stop", () => {
    cleanupAudioAnalysis();
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
    recordBtn.classList.remove("recording");
    recordBtn.textContent = "Start recording";
    voiceWaveform.classList.remove("active");
    stopTimer();
    transcribeRecording();
  });
  setupAudioAnalysis(mediaStream);
  mediaRecorder.start();
  voiceWaveform.classList.add("active");
  recordBtn.classList.add("recording");
  recordBtn.textContent = "Stop recording";
  setVoiceStatus("Recording…");
  startTimer();
}

function stopMediaRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
}

function setupAudioAnalysis(stream) {
  cleanupAudioAnalysis();
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);
  lastSoundTimestamp = Date.now();
  const dataArray = new Uint8Array(analyser.fftSize);
  silenceCheckInterval = setInterval(() => {
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i += 1) {
      const sample = (dataArray[i] - 128) / 128;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const now = Date.now();
    if (rms > SILENCE_THRESHOLD) {
      lastSoundTimestamp = now;
    } else if (now - lastSoundTimestamp > SILENCE_DURATION_MS) {
      stopMediaRecording();
    }
  }, 150);
}

function cleanupAudioAnalysis() {
  if (silenceCheckInterval) {
    clearInterval(silenceCheckInterval);
    silenceCheckInterval = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
  analyser = null;
}

async function transcribeRecording() {
  if (!recordedChunks.length) {
    setVoiceStatus("No speech detected");
    return;
  }
  setVoiceStatus("Processing voice…");
  const blob = new Blob(recordedChunks, { type: "audio/webm" });
  recordedChunks = [];
  const formData = new FormData();
  formData.append("audio", blob, "response.webm");
  try {
    const resp = await fetch("/api/transcribe", { method: "POST", body: formData });
    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(payload.error || "Transcription failed");
    const text = (payload.text || "").trim();
    if (text) {
      setVoiceStatus("Mic ready");
      sendResponse(text);
    } else {
      setVoiceStatus("No speech detected");
    }
  } catch (err) {
    setVoiceStatus(err.message || "Transcription failed");
  }
}

function setVoiceStatus(text) {
  voiceStatus.textContent = text;
}

function startTimer() {
  recordingSeconds = 0;
  timerEl.textContent = "00:00";
  if (recordingInterval) clearInterval(recordingInterval);
  recordingInterval = setInterval(() => {
    recordingSeconds += 1;
    const minutes = Math.floor(recordingSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (recordingSeconds % 60).toString().padStart(2, "0");
    timerEl.textContent = `${minutes}:${seconds}`;
  }, 1000);
}

function stopTimer() {
  if (recordingInterval) {
    clearInterval(recordingInterval);
    recordingInterval = null;
  }
}

async function ensureMicPermission() {
  if (micPermissionGranted) return true;
  if (micPermissionDenied) return false;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    micPermissionDenied = true;
    setVoiceStatus("Mic access unavailable");
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    micPermissionGranted = true;
    return true;
  } catch (err) {
    micPermissionDenied = true;
    setVoiceStatus("Mic permission denied");
    return false;
  }
}

function enableVoice() {
  if (voiceEnabled) return;
  voiceEnabled = true;
  recordBtn.disabled = false;
  recordBtn.removeAttribute("disabled");
  setVoiceStatus("Mic ready");
}

function disableInteraction() {
  recordBtn.disabled = true;
  startBtn.disabled = false;
  interviewDone = true;
  setVoiceStatus("Interview complete");
  if (!ibReportRedirected) {
    ibReportRedirected = true;
    setTimeout(() => {
      window.location.href = "/app/report?mode=ib";
    }, 1200);
  }
}

async function startSession() {
  interviewDone = false;
  ibReportRedirected = false;
  const product = productSelect.value;
  const industry = industrySelect.value;
  if (!product || !industry) {
    alert("Select product and industry groups.");
    return;
  }
  const micOk = await ensureMicPermission();
  if (!micOk) return;
  enableVoice();
  startBtn.disabled = true;
  setLoading(true, "Starting interview…");
  try {
    const data = await api("/api/ib/start", {
      method: "POST",
      body: JSON.stringify({ product_group: product, industry_group: industry }),
    });
    updateEvents(data.events);
    if (data.turns && data.turns.length) {
      const utterance = data.turns[data.turns.length - 1].next_utterance;
      speak(utterance);
    }
  } catch (err) {
    alert(err.message);
    startBtn.disabled = false;
  } finally {
    setLoading(false);
  }
}

async function sendResponse(text) {
  if (interviewDone) return;
  setLoading(true, "Reviewing response…");
  try {
    const data = await api("/api/ib/respond", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    updateEvents(data.events);
    if (data.turns && data.turns.length) {
      const utterance = data.turns[data.turns.length - 1].next_utterance;
      speak(utterance);
    }
    if (data.done) {
      disableInteraction();
    }
  } catch (err) {
    alert(err.message);
  } finally {
    setLoading(false);
  }
}

if (repeatPromptBtn) {
  repeatPromptBtn.addEventListener("click", () => {
    if (latestPromptText) speak(latestPromptText);
  });
}

recordBtn.addEventListener("click", () => {
  if (!voiceEnabled || interviewDone) return;
  if (useSpeechRecognition && recognition) {
    if (isRecording) {
      stopListening();
    } else {
      startListening();
    }
    return;
  }
  if (mediaRecorder && mediaRecorder.state === "recording") {
    stopMediaRecording();
  } else {
    startMediaRecording();
  }
});

startBtn.addEventListener("click", startSession);

initSpeech();
