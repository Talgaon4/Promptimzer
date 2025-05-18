//content_script.js
const BUTTON_CLASS = "promptimizer-btn";

function injectStyles() {
  if (document.getElementById("promptimizer-styles")) return;
  const css = `
    .${BUTTON_CLASS} {
      margin-left: 0px;
      margin-bottom: 8px;
      padding: 4px 8px;
      font-size: 0.9em;
      background: #2d8cff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      opacity: 0.6;
      display:block;
      transition: opacity 0.2s ease;
    }
    .${BUTTON_CLASS}.enabled { opacity: 1; }
    .${BUTTON_CLASS}.loading {
      opacity: 0.4;
      cursor: default;
    }
  `;
  const style = document.createElement("style");
  style.id = "promptimizer-styles";
  style.textContent = css;
  document.head.appendChild(style);
}

function getCandidates() {
  return [
    ...document.querySelectorAll('textarea, [contenteditable="true"]'),
  ].filter((el) => {
    if (!el.offsetParent || el.dataset.hasPromptRefiner) return false;

    // Exclude elements likely to be code editors or canvas
    const container = el.closest(
      '[class*="canvas"], [class*="code"], pre, code'
    );
    const isLikelyCodeEditor = container !== null;

    // Optionally check for aria-labels or placeholders to identify prompt areas
    const promptLike =
      el.getAttribute("aria-label")?.toLowerCase().includes("prompt") ||
      el.getAttribute("placeholder")?.toLowerCase().includes("ask");

    return (
      !isLikelyCodeEditor &&
      (el.tagName === "TEXTAREA" || promptLike || el.isContentEditable)
    );
  });
}

function getSiteConfig(cb) {
  chrome.storage.local.get(
    ["openaiKey", "model", "temperature", "maxTokens"],
    ({ openaiKey, model, temperature, maxTokens }) => {
      cb({
        hasKey: !!openaiKey,
        model: model || "gpt-3.5-turbo",
        temperature: temperature ?? 0.7,
        maxTokens: maxTokens ?? 300,
      });
    }
  );
}

// Creates API Key Modal
function createApiKeyModal() {
  // Check if the modal already exists
  const existingModal = document.getElementById("promptimizer-modal");
  if (existingModal) return existingModal;

  // Create modal elements
  const backdrop = document.createElement("div");
  backdrop.className = "promptimizer-modal-backdrop";
  backdrop.id = "promptimizer-modal-backdrop";

  const modal = document.createElement("div");
  modal.className = "promptimizer-modal";
  modal.id = "promptimizer-modal";

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
  const cancelBtn = modal.querySelector(".cancel");
  const saveBtn = modal.querySelector(".save");
  const apiKeyInput = modal.querySelector("#api-key-input");

  cancelBtn.addEventListener("click", () => hideModal());

  saveBtn.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      apiKeyInput.style.borderColor = "red";
      return;
    }

    chrome.storage.local.set({ openaiKey: apiKey }, () => {
      hideModal();
      // Optionally show a success message
      const toast = document.createElement("div");
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
      toast.textContent = "API Key saved successfully!";
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    });
  });

  // Close by clicking outside
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) hideModal();
  });

  return backdrop;
}

// Shows API key modal
function showApiKeyModal() {
  let modal = document.getElementById("promptimizer-modal-backdrop");

  if (!modal) {
    modal = createApiKeyModal();
  } else {
    // Reset API key input and border style
    const apiKeyInput = modal.querySelector("#api-key-input");
    if (apiKeyInput) {
      apiKeyInput.value = "";
      apiKeyInput.style.borderColor = "";
    }
  }

  modal.style.display = "flex";
}

// Hides API key modal
function hideModal() {
  const modal = document.getElementById("promptimizer-modal-backdrop");
  if (modal) modal.style.display = "none";
}

function addOptimizeButtons() {
  console.log("addOptimizeButtons called");

  injectStyles();

  const candidates = getCandidates();
  candidates.forEach((el) => {
    if (el.dataset.hasPromptRefiner === "true") return;
    el.dataset.hasPromptRefiner = "true";
    const existingBtn = el.parentElement?.querySelector(".promptimizer-btn");
    if (existingBtn) return; // button already added
    const btn = document.createElement("button");
    btn.textContent = "Optimize Prompt";
    btn.type = "button";
    btn.className = BUTTON_CLASS;

    const getTextOnly = (el) =>
      el.tagName === "TEXTAREA" ? el.value : el.innerText;

    const updateState = () => {
      const text = getTextOnly(el);
      const ok = text.trim().length > 0;
      btn.disabled = !ok;
      btn.classList.toggle("enabled", ok);
    };

    el.addEventListener("input", updateState);
    el.addEventListener("keyup", updateState);

    btn.addEventListener("click", () => {
      btn.classList.add("loading");
      btn.disabled = true;

      const promptText = getTextOnly(el);
      getSiteConfig((cfg) => {
        if (!cfg.hasKey) {
          showApiKeyModal();
          btn.classList.remove("loading");
          return updateState();
        }

        chrome.runtime.sendMessage(
          {
            action: "optimize",
            prompt: promptText,
            model: cfg.model,
            temperature: cfg.temperature,
            maxTokens: cfg.maxTokens,
          },
          (response) => {
            // Messaging failure
            if (chrome.runtime.lastError) {
              console.error(
                "⚠️ Messaging failed:",
                chrome.runtime.lastError.message
              );
              alert("Extension error: cannot reach background service.");
              btn.classList.remove("loading");
              return updateState();
            }
            // Response error or no optimized text
            if (!response) {
              console.error("⚠️ Refiner error: No response received");
              alert(
                "Prompt Refiner encountered an error:\nNo response received"
              );
              btn.classList.remove("loading");
              return updateState();
            }

            if (response.error) {
              console.error("⚠️ Refiner error:", response.error);

              // Check if the error is related to API key issues
              if (
                response.error.includes("API key") ||
                response.error.includes("authentication") ||
                response.error.includes("401")
              ) {
                // Show our custom modal instead of alert
                showApiKeyModal();
              } else {
                // For other errors, show a regular alert
                alert(
                  "Prompt Refiner encountered an error:\n" + response.error
                );
              }

              btn.classList.remove("loading");
              return updateState();
            }

            if (!response.optimized) {
              console.error("⚠️ Refiner error: No optimized text returned");
              alert(
                "Prompt Refiner encountered an error:\nNo optimized text returned"
              );
              btn.classList.remove("loading");
              return updateState();
            }

            if ("value" in el) el.value = response.optimized;
            else el.innerText = response.optimized;

            btn.classList.remove("loading");
            btn.disabled = false;
            btn.textContent = "Optimized!";
            setTimeout(() => {
              btn.textContent = "Optimize Prompt";
              updateState();
            }, 1500);
          }
        );
      });
    });

    // el.insertAdjacentElement("afterend", btn);
    let container =
      el.closest("._prosemirror-parent_kfgfu_2") || // specific wrapper for ChatGPT
      el.closest(".ProseMirror")?.parentElement || // fallback
      el.closest("form") ||
      el.parentElement;
    container.insertBefore(btn, el);
    updateState();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupPromptRefinerObserver);
} else {
  setupPromptRefinerObserver();
}

function setupPromptRefinerObserver() {
  new MutationObserver(() => {
    clearTimeout(window.__debouncePromptRefiner);
    window.__debouncePromptRefiner = setTimeout(addOptimizeButtons, 300);
  }).observe(document.body, { childList: true, subtree: true });
}
