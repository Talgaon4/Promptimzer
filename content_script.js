const BUTTON_CLASS = 'prompt-refiner-btn';

// Inject your button CSS directly so you don't have to load a separate file:
function injectStyles() {
  if (document.getElementById('prompt-refiner-styles')) return;
  const css = `
    .${BUTTON_CLASS} {
      margin-bottom: 8px;
      padding: 4px 8px;
      font-size: 0.9em;
      background: #2d8cff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      opacity: 0.6;
      transition: opacity 0.2s ease;
    }
    .${BUTTON_CLASS}.enabled { opacity: 1; }
    .${BUTTON_CLASS}.loading {
      opacity: 0.4;
      cursor: default;
    }
  `;
  const style = document.createElement('style');
  style.id = 'prompt-refiner-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

// Creates API Key Modal
function createApiKeyModal() {
  // Check if the modal already exists
  const existingModal = document.getElementById('prompt-refiner-modal');
  if (existingModal) return existingModal;

  // Create modal elements
  const backdrop = document.createElement('div');
  backdrop.className = 'prompt-refiner-modal-backdrop';
  backdrop.id = 'prompt-refiner-modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'prompt-refiner-modal';
  modal.id = 'prompt-refiner-modal';

  // Modal content
  modal.innerHTML = `
    <h2>API Key Required</h2>
    <p>Please enter your OpenAI API key to use Prompt Refiner.</p>
    <p><small>Get your API key from <a href="https://platform.openai.com/account/api-keys" target="_blank">OpenAI's platform</a></small></p>
    
    <label for="api-key-input">OpenAI API Key</label>
    <input type="password" id="api-key-input" placeholder="sk-..." />
    
    <div class="actions">
      <button class="cancel">Cancel</button>
      <button class="save">Save Key</button>
    </div>
  `;

  // Add modal to backdrop
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // Modal events
  const cancelBtn = modal.querySelector('.cancel');
  const saveBtn = modal.querySelector('.save');
  const apiKeyInput = modal.querySelector('#api-key-input');

  cancelBtn.addEventListener('click', () => hideModal());
  
  saveBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      apiKeyInput.style.borderColor = 'red';
      return;
    }
    
    chrome.storage.local.set({ openaiKey: apiKey }, () => {
      hideModal();
      // Optionally show a success message
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #4CAF50;
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        z-index: 10000;
      `;
      toast.textContent = 'API Key saved successfully!';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    });
  });

  // Close by clicking outside
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) hideModal();
  });

  return backdrop;
}

// Shows API key modal
function showApiKeyModal() {
  const modal = createApiKeyModal();
  modal.style.display = 'flex';
}

// Hides API key modal
function hideModal() {
  const modal = document.getElementById('prompt-refiner-modal-backdrop');
  if (modal) modal.style.display = 'none';
}

// Find candidate inputs for various LLM UIs
function getCandidates() {
  const host = location.hostname;
  if (host.endsWith('chat.openai.com')) {
    return Array.from(
      document.querySelectorAll('div[role="textbox"][contenteditable]')
    );
  } else if (host.endsWith('gemini.google.com')) {
    return Array.from(document.querySelectorAll('textarea'));
  } else if (host.includes('claude.ai')) {
    return Array.from(
      document.querySelectorAll('textarea, [contenteditable]')
    );
  }
  return [];
}

// Get saved settings (including API key flag)
function getSiteConfig(cb) {
  chrome.storage.local.get(
    ['openaiKey', 'model', 'temperature', 'maxTokens'],
    ({ openaiKey, model, temperature, maxTokens }) => {
      cb({
        hasKey: !!openaiKey,
        model: model || 'gpt-3.5-turbo',
        temperature: temperature != null ? temperature : 0.7,
        maxTokens: maxTokens != null ? maxTokens : 300
      });
    }
  );
}

// Main routine: add buttons and handle clicks
function addOptimizeButtons() {
  injectStyles();
  const inputs = getCandidates();

  for (const el of inputs) {
    if (!el.isConnected || el.dataset.hasPromptRefiner) continue;
    el.dataset.hasPromptRefiner = 'true';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Optimize Prompt';
    btn.className = BUTTON_CLASS;

    // Enable/disable based on input content
    const updateState = () => {
      const text = el.value ?? el.innerText ?? '';
      const ok = text.trim().length > 0;
      btn.disabled = !ok;
      btn.classList.toggle('enabled', ok);
    };
    el.addEventListener('input', updateState);
    el.addEventListener('keyup', updateState);
    updateState();

    btn.addEventListener('click', () => {
      btn.classList.add('loading');
      btn.disabled = true;

      const promptText = el.value ?? el.innerText ?? '';
      getSiteConfig(cfg => {
        if (!cfg.hasKey) {
          // Show modal instead of alert
          showApiKeyModal();
          btn.classList.remove('loading');
          return updateState();
        }

        // Send to background
        chrome.runtime.sendMessage(
          {
            action: 'optimize',
            prompt: promptText,
            model: cfg.model,
            temperature: cfg.temperature,
            maxTokens: cfg.maxTokens
          },
          response => {
            // Messaging failure
            if (chrome.runtime.lastError) {
              console.error('⚠️ Messaging failed:', chrome.runtime.lastError.message);
              alert('Extension error: cannot reach background service.');
              btn.classList.remove('loading');
              return updateState();
            }
            // Response error or no optimized text
            if (!response) {
              console.error('⚠️ Refiner error: No response received');
              alert('Prompt Refiner encountered an error:\nNo response received');
              btn.classList.remove('loading');
              return updateState();
            }
            
            if (response.error) {
              console.error('⚠️ Refiner error:', response.error);
              
              // Check if the error is related to API key issues
              if (response.error.includes('API key') || response.error.includes('authentication')) {
                // Show our custom modal instead of alert
                showApiKeyModal();
              } else {
                // For other errors, show a regular alert
                alert('Prompt Refiner encountered an error:\n' + response.error);
              }
              
              btn.classList.remove('loading');
              return updateState();
            }
            
            if (!response.optimized) {
              console.error('⚠️ Refiner error: No optimized text returned');
              alert('Prompt Refiner encountered an error:\nNo optimized text returned');
              btn.classList.remove('loading');
              return updateState();
            }
            // Success: replace input
            if ('value' in el) {
              el.value = response.optimized;
            } else {
              el.innerText = response.optimized;
            }
            btn.classList.remove('loading');
            updateState();
          }
        );
      });
    });

    const container = el.closest('form') || el.parentElement;
    container.insertBefore(btn, el);
  }
}

addOptimizeButtons();
new MutationObserver(addOptimizeButtons).observe(document.body, {
  childList: true,
  subtree: true
});