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
  ].filter((el) => el.offsetParent && !el.dataset.hasPromptRefiner);
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

function showApiKeyModal() {
  alert("API key is missing. Please add your OpenAI API key.");
}

function addOptimizeButtons() {
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
            btn.classList.remove("loading");

            if (!response || response.error || !response.optimized) {
              console.error("Error optimizing prompt:", response?.error);
              alert(response?.error || "An unknown error occurred.");
              return updateState();
            }

            if ("value" in el) el.value = response.optimized;
            else el.innerText = response.optimized;

            btn.textContent = "Optimized!";
            setTimeout(() => (btn.textContent = "Optimize Prompt"), 1500);
            updateState();
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

addOptimizeButtons();

new MutationObserver(() => {
  clearTimeout(window.__debouncePromptRefiner);
  window.__debouncePromptRefiner = setTimeout(addOptimizeButtons, 300);
}).observe(document.body, { childList: true, subtree: true });
