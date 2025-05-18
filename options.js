// Elements
const apiInput = document.getElementById("apiKey");
const maxTokens = document.getElementById("maxTokens");
const form = document.getElementById("settingsForm");
const status = document.getElementById("status");

// Load settings
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(
    ["openaiKey", "maxTokens"],
    ({ openaiKey, maxTokens: tokens }) => {
      if (openaiKey) apiInput.value = openaiKey;
      maxTokens.value = tokens || 300;
    }
  );
});

// Save on submit
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const cfg = {
    openaiKey: apiInput.value.trim(),
    maxTokens: parseInt(maxTokens.value, 10),
  };
  chrome.storage.local.set(cfg, () => {
    status.textContent = "Settings saved!";
    setTimeout(() => (status.textContent = ""), 2000);
  });
});
