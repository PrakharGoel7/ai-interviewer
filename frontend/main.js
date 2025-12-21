const transcriptEl = document.getElementById("transcript");
const startBtn = document.getElementById("start-btn");
const form = document.getElementById("response-form");
const textarea = document.getElementById("response-text");
const enableVoiceBtn = document.getElementById("enable-voice-btn");
const recordBtn = document.getElementById("record-btn");
const voiceStatus = document.getElementById("voice-status");
const tableContainer = document.getElementById("tableContainer");
let chartInstance = null;
let recognition = null;
let isRecording = false;
let voiceEnabled = false;
let pendingListenTimeout = null;

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

function renderTranscript(events) {
  transcriptEl.innerHTML = "";
  events.forEach((evt) => {
    const div = document.createElement("div");
    div.className = `message ${evt.role}`;
    const who = evt.role === "interviewer" ? "Interviewer" : "You";
    div.innerHTML = `<div class="role">${who}</div><div>${evt.text}</div>`;
    transcriptEl.appendChild(div);
  });
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
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
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.25)",
          tension: 0.2,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: { title: { display: !!spec.x_label, text: spec.x_label || "" } },
        y: { title: { display: !!spec.y_label, text: spec.y_label || "" } },
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
  if (latest && latest.next_utterance) {
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
  if (!SpeechRecognition) {
    enableVoiceBtn.disabled = true;
    recordBtn.disabled = true;
    voiceStatus.textContent = "Voice not supported";
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("start", () => {
    isRecording = true;
    voiceStatus.textContent = "Listening...";
    recordBtn.classList.add("recording");
    recordBtn.textContent = "Stop Recording";
  });

  recognition.addEventListener("end", () => {
    isRecording = false;
    recordBtn.classList.remove("recording");
    recordBtn.textContent = "Start Recording";
    voiceStatus.textContent = voiceEnabled ? "Ready to record" : "Voice disabled";
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
    voiceStatus.textContent = "Error. Try again.";
    recordBtn.classList.remove("recording");
    recordBtn.textContent = "Start Recording";
  });

  enableVoiceBtn.addEventListener("click", () => {
    if (!recognition) return;
    voiceEnabled = true;
    enableVoiceBtn.disabled = true;
    enableVoiceBtn.textContent = "Voice Enabled";
    recordBtn.disabled = false;
    voiceStatus.textContent = "Ready to record";
  });

  recordBtn.addEventListener("click", () => {
    if (!voiceEnabled || !recognition) return;
    if (isRecording) {
      stopListening();
    } else {
      startListening();
    }
  });
}

function startListening() {
  if (!voiceEnabled || !recognition || isRecording) {
    return;
  }
  try {
    recognition.start();
  } catch (err) {
    // ignore consecutive start errors
  }
}

function stopListening() {
  if (!recognition || !isRecording) {
    return;
  }
  recognition.stop();
}

async function startCase() {
  try {
    const data = await api("/api/start", { method: "POST" });
    renderTranscript(data.events);
    handleTurns(data.turns);
  } catch (err) {
    alert(err.message);
  }
}

async function sendResponse(text) {
  try {
    const data = await api("/api/respond", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    renderTranscript(data.events);
    handleTurns(data.turns);
  } catch (err) {
    alert(err.message);
  }
}

startBtn.addEventListener("click", () => {
  startCase();
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = textarea.value.trim();
  if (!text) return;
  textarea.value = "";
  sendResponse(text);
});

startCase();
initSpeech();
