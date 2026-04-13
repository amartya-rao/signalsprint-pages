const API_BASE_URL = "https://api.signalsprint.tech";

const state = {
  activeTab: "upload",
  uploadFile: null,
  capturedBlob: null,
  previewUrl: null,
  browserLocation: null,
  uploadLocation: null,
  stream: null,
};

const refs = {
  apiBaseLabel: document.getElementById("apiBaseLabel"),
  apiHealth: document.getElementById("apiHealth"),
  browserLocationStatus: document.getElementById("browserLocationStatus"),
  uploadTab: document.getElementById("uploadTab"),
  cameraTab: document.getElementById("cameraTab"),
  uploadPanel: document.getElementById("uploadPanel"),
  cameraPanel: document.getElementById("cameraPanel"),
  uploadInput: document.getElementById("uploadInput"),
  restartCameraButton: document.getElementById("restartCameraButton"),
  captureButton: document.getElementById("captureButton"),
  cameraPreview: document.getElementById("cameraPreview"),
  captureCanvas: document.getElementById("captureCanvas"),
  selectedImageName: document.getElementById("selectedImageName"),
  previewImage: document.getElementById("previewImage"),
  previewPlaceholder: document.getElementById("previewPlaceholder"),
  clearSelectionButton: document.getElementById("clearSelectionButton"),
  analyzeButton: document.getElementById("analyzeButton"),
  submissionStatus: document.getElementById("submissionStatus"),
  decisionBanner: document.getElementById("decisionBanner"),
  probabilityValue: document.getElementById("probabilityValue"),
  binaryValue: document.getElementById("binaryValue"),
  modeValue: document.getElementById("modeValue"),
  policyNotes: document.getElementById("policyNotes"),
  sceneSummary: document.getElementById("sceneSummary"),
  locationText: document.getElementById("locationText"),
  mapsLink: document.getElementById("mapsLink"),
};

refs.apiBaseLabel.textContent = API_BASE_URL;

function setStatus(message, isError = false) {
  refs.submissionStatus.textContent = message;
  refs.submissionStatus.style.color = isError ? "#b6432d" : "#6e7d74";
}

function switchTab(tabName) {
  state.activeTab = tabName;
  const uploadActive = tabName === "upload";
  refs.uploadTab.classList.toggle("is-active", uploadActive);
  refs.cameraTab.classList.toggle("is-active", !uploadActive);
  refs.uploadPanel.classList.toggle("is-active", uploadActive);
  refs.cameraPanel.classList.toggle("is-active", !uploadActive);
}

function setPreview(blobOrFile, label) {
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
  }
  state.previewUrl = URL.createObjectURL(blobOrFile);
  refs.previewImage.src = state.previewUrl;
  refs.previewImage.hidden = false;
  refs.previewPlaceholder.hidden = true;
  refs.selectedImageName.textContent = label;
}

function clearSelection() {
  state.uploadFile = null;
  state.capturedBlob = null;
  state.uploadLocation = null;
  refs.uploadInput.value = "";
  refs.selectedImageName.textContent = "No image selected";
  refs.previewImage.hidden = true;
  refs.previewPlaceholder.hidden = false;
  refs.previewImage.removeAttribute("src");
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
  }
  setLocationCard(null);
  setStatus("Select an image to begin.");
}

function toMapsLink(location) {
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}

function setLocationCard(location) {
  if (!location) {
    refs.locationText.textContent = "No upload or device location available yet.";
    refs.mapsLink.hidden = true;
    refs.mapsLink.removeAttribute("href");
    return;
  }
  refs.locationText.textContent = `${location.source}: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  refs.mapsLink.href = toMapsLink(location);
  refs.mapsLink.hidden = false;
}

function activeLocation() {
  if (state.activeTab === "upload" && state.uploadLocation) {
    return state.uploadLocation;
  }
  if (state.activeTab === "camera" && state.browserLocation) {
    return {
      ...state.browserLocation,
      source: "Browser location",
    };
  }
  return state.browserLocation
    ? { ...state.browserLocation, source: "Browser location" }
    : null;
}

function renderPolicyNotes(notes = []) {
  refs.policyNotes.innerHTML = "";
  const safeNotes = notes.length ? notes : ["No policy notes available."];
  for (const note of safeNotes) {
    const item = document.createElement("li");
    item.textContent = note;
    refs.policyNotes.appendChild(item);
  }
}

function renderSceneSummary(summary = {}) {
  refs.sceneSummary.innerHTML = "";
  const entries = Object.entries(summary);
  if (!entries.length) {
    const chip = document.createElement("span");
    chip.className = "summary-chip";
    chip.textContent = "No summary yet.";
    refs.sceneSummary.appendChild(chip);
    return;
  }
  for (const [key, value] of entries) {
    const chip = document.createElement("span");
    chip.className = "summary-chip";
    chip.textContent = `${key.replaceAll("_", " ")}: ${value}`;
    refs.sceneSummary.appendChild(chip);
  }
}

function updateDecisionBanner(result) {
  refs.decisionBanner.classList.toggle("is-positive", result.binary_prediction === 1);
  refs.decisionBanner.querySelector(".decision-kicker").textContent = "Analysis complete";
  refs.decisionBanner.querySelector(".decision-title").textContent = result.decision;
  refs.decisionBanner.querySelector(".decision-subtitle").textContent =
    result.binary_prediction === 1
      ? "This scene crosses the configured DMC action threshold."
      : "This scene stays below the configured DMC action threshold.";
}

async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();
    refs.apiHealth.textContent = data.model_ready ? "Ready" : "Model issue";
  } catch {
    refs.apiHealth.textContent = "Unavailable";
  }
}

function requestLocation() {
  if (!navigator.geolocation) {
    refs.browserLocationStatus.textContent = "Not supported";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      state.browserLocation = {
        source: "Browser location",
        latitude: coords.latitude,
        longitude: coords.longitude,
      };
      refs.browserLocationStatus.textContent = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
      if (!state.uploadFile && !state.capturedBlob) {
        setLocationCard(state.browserLocation);
      }
    },
    () => {
      refs.browserLocationStatus.textContent = "Permission denied";
    },
    { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 },
  );
}

async function ensureCameraPreview() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Camera access is not supported in this browser.", true);
    return;
  }
  try {
    if (state.stream) {
      state.stream.getTracks().forEach((track) => track.stop());
    }
    state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    refs.cameraPreview.srcObject = state.stream;
  } catch {
    setStatus("Camera access was blocked or is unavailable.", true);
  }
}

async function handleUploadChange(event) {
  const [file] = event.target.files || [];
  if (!file) return;
  state.uploadFile = file;
  state.capturedBlob = null;
  switchTab("upload");
  setPreview(file, file.name);
  state.uploadLocation = null;
  if (window.exifr) {
    try {
      const gps = await window.exifr.gps(file);
      if (gps?.latitude && gps?.longitude) {
        state.uploadLocation = {
          source: "Image metadata",
          latitude: gps.latitude,
          longitude: gps.longitude,
        };
      }
    } catch {
      state.uploadLocation = null;
    }
  }
  setLocationCard(activeLocation());
  setStatus("Image ready for analysis.");
}

async function captureFrame() {
  const video = refs.cameraPreview;
  if (!video.videoWidth || !video.videoHeight) {
    setStatus("Camera frame is not ready yet.", true);
    return;
  }
  const canvas = refs.captureCanvas;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
  if (!blob) {
    setStatus("Could not capture the current frame.", true);
    return;
  }
  state.capturedBlob = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
  state.uploadFile = null;
  switchTab("camera");
  setPreview(state.capturedBlob, state.capturedBlob.name);
  setLocationCard(activeLocation());
  setStatus("Captured frame ready for analysis.");
}

async function analyzeScene() {
  const image = state.activeTab === "camera" ? state.capturedBlob : state.uploadFile || state.capturedBlob;
  if (!image) {
    setStatus("Select or capture an image first.", true);
    return;
  }

  setStatus("Sending image to inference API…");
  refs.analyzeButton.disabled = true;
  try {
    const formData = new FormData();
    formData.append("image", image, image.name);

    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "API request failed");
    }

    refs.probabilityValue.textContent = `${(data.probability * 100).toFixed(1)}%`;
    refs.binaryValue.textContent = String(data.binary_prediction);
    refs.modeValue.textContent = data.mode || "inference";
    updateDecisionBanner(data);
    renderPolicyNotes(data.policy_notes || []);
    renderSceneSummary(data.scene_summary || {});
    setLocationCard(activeLocation());
    setStatus("Analysis complete.");
  } catch (error) {
    setStatus(error.message || "Analysis failed.", true);
  } finally {
    refs.analyzeButton.disabled = false;
  }
}

refs.uploadTab.addEventListener("click", () => switchTab("upload"));
refs.cameraTab.addEventListener("click", () => switchTab("camera"));
refs.uploadInput.addEventListener("change", handleUploadChange);
refs.captureButton.addEventListener("click", captureFrame);
refs.restartCameraButton.addEventListener("click", ensureCameraPreview);
refs.clearSelectionButton.addEventListener("click", clearSelection);
refs.analyzeButton.addEventListener("click", analyzeScene);

checkHealth();
requestLocation();
ensureCameraPreview();
setLocationCard(null);
