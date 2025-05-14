// Elements
const apiInput    = document.getElementById('apiKey');
const modelSelect = document.getElementById('model');
const tempSlider  = document.getElementById('temperature');
const tempValue   = document.getElementById('tempVal');
const maxTokens   = document.getElementById('maxTokens');
const form        = document.getElementById('settingsForm');
const status      = document.getElementById('status');

// Load settings
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(
    ['openaiKey','model','temperature','maxTokens'],
    ({ openaiKey, model, temperature, maxTokens: tokens }) => {
      if (openaiKey) apiInput.value = openaiKey;
      modelSelect.value = model || 'gpt-3.5-turbo';
      tempSlider.value  = temperature != null ? temperature : 0.7;
      tempValue.textContent = tempSlider.value;
      maxTokens.value   = tokens || 300;
    }
  );
});

// Reflect slider value in UI
tempSlider.addEventListener('input', () => {
  tempValue.textContent = tempSlider.value;
});

// Save on submit
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const cfg = {
    openaiKey: apiInput.value.trim(),
    model: modelSelect.value,
    temperature: parseFloat(tempSlider.value),
    maxTokens: parseInt(maxTokens.value, 10)
  };
  chrome.storage.local.set(cfg, () => {
    status.textContent = 'Settings saved!';
    setTimeout(() => status.textContent = '', 2000);
  });
});
