const startBtn = document.getElementById("start-btn");
const form = document.getElementById("response-form");
const textarea = document.getElementById("response-text");
const recordBtn = document.getElementById("record-btn");
const firmSelect = document.getElementById("firm-select");
const caseTypeSelect = document.getElementById("case-type-select");
const voiceStatus = document.getElementById("voice-status");
const currentPromptEl = document.getElementById("current-prompt");
const repeatPromptBtn = document.getElementById("repeat-prompt-btn");
const skipBtn = document.getElementById("skip-btn");
const timerEl = document.getElementById("recording-timer");
const voiceWaveform = document.getElementById("voice-waveform");
const tableContainer = document.getElementById("tableContainer");
const loadingIndicator = document.getElementById("loading-indicator");
const loadingText = document.getElementById("loading-text");

let chartInstance = null;
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
let reportRedirected = false;
let recordingStartMs = 0;

const SILENCE_THRESHOLD = 0.02;
const SILENCE_DURATION_MS = 1500;
const MIN_RECORDING_MS = 4000;

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

function updatePrompt(events) {
  if (!Array.isArray(events) || !events.length) {
    const placeholderOptions = currentPromptEl.dataset.placeholderOptions;
    if (placeholderOptions) {
      const options = JSON.parse(placeholderOptions);
      const choice = options[Math.floor(Math.random() * options.length)];
      currentPromptEl.textContent = choice;
    }
    return;
  }
  const lastInterviewer = [...events].reverse().find((evt) => evt.role === "interviewer");
  if (lastInterviewer) {
    latestPromptText = lastInterviewer.text;
    currentPromptEl.textContent = lastInterviewer.text;
  }
}

function renderChart(spec) {
  if (!spec) {
    return;
  }
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  tableContainer.innerHTML = "";
  const ctx = document.getElementById("chartCanvas").getContext("2d");

  if (spec.type === "table") {
    const table = document.createElement("table");
    const headerRow = document.createElement("tr");
    Object.keys(spec.data[0]).forEach((key) => {
      const th = document.createElement("th");
      th.textContent = key;
      headerRow.appendChild(th);
    });
    table.appendChild(headerRow);
    spec.data.forEach((row) => {
      const tr = document.createElement("tr");
      Object.keys(row).forEach((key) => {
        const td = document.createElement("td");
        td.textContent = row[key];
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    tableContainer.appendChild(table);
    return;
  }

  let labels = [];
  let dataset = [];
  if (spec.type === "bar") {
    labels = Object.keys(spec.data);
    dataset = Object.values(spec.data);
  } else if (spec.type === "line" || spec.type === "scatter") {
    labels = spec.data.map((p) => p.x);
    dataset = spec.data.map((p) => p.y);
  }

  chartInstance = new Chart(ctx, {
    type: spec.type === "scatter" ? "line" : spec.type,
    data: {
      labels,
      datasets: [
        {
          label: spec.title,
          data: dataset,
          borderColor: "#0F172A",
          backgroundColor: "rgba(15, 23, 42, 0.2)",
          tension: 0.2,
          fill: spec.type !== "bar" ? false : "origin",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          title: { display: !!spec.x_label, text: spec.x_label || "" },
          grid: { color: "rgba(17, 24, 39, 0.08)" },
        },
        y: {
          title: { display: !!spec.y_label, text: spec.y_label || "" },
          grid: { color: "rgba(17, 24, 39, 0.08)" },
        },
      },
    },
  });
}

function handleTurns(turns) {
  if (!turns) return;
  const chartTurn = [...turns].reverse().find((t) => t.chart_spec);
  if (chartTurn) {
    renderChart(chartTurn.chart_spec);
  }
  const latest = turns[turns.length - 1];
  const shouldShowReport =
    latest &&
    latest.stage_id === "end_feedback" &&
    (latest.next_action === "SHOW_REPORT" || !latest.next_utterance);
  if (shouldShowReport && !reportRedirected) {
    reportRedirected = true;
    setTimeout(() => {
      window.location.href = "/app/report";
    }, 200);
    return;
  }
  if (latest && latest.next_utterance) {
    latestPromptText = latest.next_utterance;
    currentPromptEl.textContent = latest.next_utterance;
    speak(latest.next_utterance);
  }
}

function speak(text) {
  if (!text) {
    return;
  }
  if (window.audioManager) {
    window.audioManager.play(text).catch((err) => {
      console.error("TTS playback failed:", err);
      fallbackSpeak(text);
    });
    return;
  }
  fallbackSpeak(text);
}

function fallbackSpeak(text) {
  if (!window.speechSynthesis) {
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function initSpeech() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    useSpeechRecognition = true;
    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.addEventListener("start", () => {
      isRecording = true;
      recordingStartMs = Date.now();
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
      recordingStartMs = 0;
      setVoiceStatus(voiceEnabled ? "Mic ready" : "Mic inactive");
    });

    recognition.addEventListener("result", (event) => {
      const transcript = event.results[0][0].transcript.trim();
      if (transcript) {
        stopListening();
        sendResponse(transcript);
      }
    });

    recognition.addEventListener("error", (event) => {
      console.error("Speech recognition error:", event.error);
      stopTimer();
      voiceWaveform.classList.remove("active");
      setVoiceStatus("Error. Try again.");
      recordBtn.classList.remove("recording");
      recordBtn.textContent = "Start recording";
    });
    return;
  }

    useSpeechRecognition = false;
    if (supportsMediaRecorder()) {
    return;
  }

  recordBtn.disabled = true;
  setVoiceStatus("Voice not supported");
}

function supportsMediaRecorder() {
  return !!(navigator.mediaDevices && window.MediaRecorder);
}

function startListening() {
  if (!voiceEnabled || !recognition || isRecording) {
    return;
  }
  try {
    recognition.start();
  } catch (err) {
    // ignore duplicate start attempts
  }
}

function stopListening() {
  if (!recognition || !isRecording) {
    return;
  }
  recognition.stop();
}

async function startMediaRecording() {
  if (!supportsMediaRecorder()) {
    setVoiceStatus("Voice not supported");
    return;
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    console.error("Unable to access microphone:", err);
    setVoiceStatus("Mic permission denied");
    return;
  }

  recordingStartMs = Date.now();
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(mediaStream);
  mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  });
  mediaRecorder.addEventListener("stop", () => {
    cleanupAudioAnalysis();
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
    recordingStartMs = 0;
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
    } else if (now - lastSoundTimestamp > SILENCE_DURATION_MS && hasMetMinimumRecordingTime()) {
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

function stopMediaRecording() {
  if (!mediaRecorder || mediaRecorder.state !== "recording") {
    return;
  }
  if (!hasMetMinimumRecordingTime()) {
    setVoiceStatus("Keep speaking for at least 4 seconds");
    return;
  }
  mediaRecorder.stop();
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
    if (!resp.ok) {
      throw new Error(payload.error || "Transcription failed");
    }
    const text = (payload.text || "").trim();
    if (text) {
      setVoiceStatus("Mic ready");
      sendResponse(text);
    } else {
      setVoiceStatus("No speech detected");
    }
  } catch (err) {
    console.error("Transcription error:", err);
    setVoiceStatus(err.message || "Transcription failed");
  }
}

function enableVoice() {
  if (voiceEnabled) {
    return;
  }
  if (!useSpeechRecognition && !supportsMediaRecorder()) {
    recordBtn.disabled = true;
    setVoiceStatus("Voice not supported");
    return;
  }
  voiceEnabled = true;
  recordBtn.disabled = false;
  recordBtn.removeAttribute("disabled");
  setVoiceStatus("Mic ready");
}

function setVoiceStatus(text) {
  voiceStatus.textContent = text;
}

function startTimer() {
  recordingSeconds = 0;
  timerEl.textContent = "00:00";
  if (recordingInterval) {
    clearInterval(recordingInterval);
  }
  recordingInterval = setInterval(() => {
    recordingSeconds += 1;
    timerEl.textContent = formatTime(recordingSeconds);
  }, 1000);
}

function stopTimer() {
  if (recordingInterval) {
    clearInterval(recordingInterval);
    recordingInterval = null;
  }
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
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

async function ensureMicPermission() {
  if (micPermissionGranted) {
    return true;
  }
  if (!supportsMediaRecorder()) {
    micPermissionGranted = true;
    return true;
  }
  if (micPermissionDenied) {
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    micPermissionGranted = true;
    return true;
  } catch (err) {
    console.error("Microphone permission denied:", err);
    setVoiceStatus("Mic permission denied");
    micPermissionDenied = true;
    return false;
  }
}

async function startCase() {
  setLoading(true, "Connecting with your interviewer…");
  try {
    const payload = {
      firm: firmSelect ? firmSelect.value : undefined,
      case_type: caseTypeSelect ? caseTypeSelect.value : undefined,
    };
    const data = await api("/api/start", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    updatePrompt(data.events);
    handleTurns(data.turns);
    return true;
  } catch (err) {
    alert(err.message);
    return false;
  } finally {
    setLoading(false);
  }
}

async function sendResponse(text) {
  setLoading(true, "Reviewing your answer…");
  try {
    const data = await api("/api/respond", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    updatePrompt(data.events);
    handleTurns(data.turns);
  } catch (err) {
    alert(err.message);
  } finally {
    setLoading(false);
  }
}

recordBtn.addEventListener("click", async () => {
  if (!voiceEnabled) return;
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
    await startMediaRecording();
  }
});

startBtn.addEventListener("click", async () => {
  const micOk = await ensureMicPermission();
  if (!micOk) {
    return;
  }
  enableVoice();
  startBtn.disabled = true;
  const ok = await startCase();
  if (!ok) {
    startBtn.disabled = false;
  }
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = textarea.value.trim();
  if (!text) return;
  textarea.value = "";
  sendResponse(text);
});

if (repeatPromptBtn) {
  repeatPromptBtn.addEventListener("click", () => {
    if (latestPromptText) {
      speak(latestPromptText);
    }
  });
}

skipBtn.addEventListener("click", () => {
  sendResponse("I'd like to skip ahead to the next question.");
});

initSpeech();
function hasMetMinimumRecordingTime() {
  if (!recordingStartMs) return false;
  return Date.now() - recordingStartMs >= MIN_RECORDING_MS;
}
