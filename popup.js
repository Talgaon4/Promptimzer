document.addEventListener("DOMContentLoaded", () => {
  const promptBox = document.getElementById("prompt-box");
  const outputContainer = document.getElementById("output-container");
  const output = document.getElementById("output");
  const copyIcon = document.getElementById("copy-icon");
  const optimizeBtn = document.getElementById("optimizePrompt");
  const copyMessage = document.getElementById("copy-message");
  const openSettingsBtn = document.getElementById("openSettings");

  // Update button state on input
  promptBox.addEventListener("input", updateButtonState);

  function updateButtonState() {
    const text = promptBox.value.trim();
    optimizeBtn.disabled = text.length === 0;
  }

  updateButtonState();

  // Optimize prompt logic (from old version)
  optimizeBtn.addEventListener("click", () => {
    const input = promptBox.value.trim();
    if (!input) return;

    optimizeBtn.disabled = true;
    optimizeBtn.textContent = "Optimizing...";

    chrome.storage.local.get(
      ["openaiKey", "model", "temperature", "maxTokens"],
      (cfg) => {
        if (!cfg.openaiKey) {
          showErrorMessage(
            "Missing API key. Please go to Settings and enter your OpenAI key."
          );
          chrome.runtime.openOptionsPage();
          optimizeBtn.disabled = false;
          optimizeBtn.textContent = "Optimize Prompt";
          return;
        }

        chrome.runtime.sendMessage(
          {
            action: "optimize",
            prompt: input,
            model: cfg.model || "gpt-3.5-turbo",
            temperature: cfg.temperature ?? 0.7,
            maxTokens: cfg.maxTokens ?? 300,
          },
          (response) => {
            optimizeBtn.disabled = false;
            optimizeBtn.textContent = "Optimize Prompt";

            if (!response || response.error) {
              const errMsg = response?.error || "No response";

              if (
                errMsg.toLowerCase().includes("api key") ||
                errMsg.toLowerCase().includes("authentication") ||
                errMsg.includes("401")
              ) {
                showApiKeyInput(); // or chrome.runtime.openOptionsPage() if you'd prefer
              } else {
                showErrorMessage("Error: " + errMsg);
              }

              return;
            }

            const optimizedText = response.optimized || "";

            output.innerHTML = `
              <div style="font-weight:bold; margin-bottom: 5px;">Optimized Prompt</div>
              <div id="optimized-text" style="white-space: pre-wrap;">${optimizedText}</div>
            `;

            outputContainer.style.display = "block";
            copyIcon.style.display = "flex";
          }
          
        );
      }
    );
  });

  copyIcon.addEventListener("click", () => {
    const text = document.getElementById("optimized-text")?.textContent || "";
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
      // Show copy message
      copyMessage.style.display = "block";
      copyMessage.style.opacity = "1";

      // Hide after delay
      setTimeout(() => {
        copyMessage.style.opacity = "0";
        setTimeout(() => {
          copyMessage.style.display = "none";
        }, 300);
      }, 1500);
    });
  });

  // Open settings page
  openSettingsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Show error message
  function showErrorMessage(message) {
    output.textContent = message;
    output.style.color = "#ef4444";
    output.style.background = "#fee2e2";
    output.style.border = "1px solid #fecaca";
    outputContainer.style.display = "block";

    setTimeout(() => {
      output.style.color = "";
      output.style.background = "";
      output.style.border = "";
    }, 3000);
  }

  // Ask user to enter their API key
  function showApiKeyInput() {
    const modalHtml = `
      <div id="api-key-modal">
        <h3>API Key Required</h3>
        <p>Please enter your OpenAI API key to use Prompt Refiner.</p>
        <input type="password" id="api-key-input" placeholder="sk-...">
        <div class="modal-actions">
          <button id="save-key-btn">Save Key</button>
          <button id="cancel-key-btn" style="background: #94a3b8;">Cancel</button>
        </div>
      </div>
    `;

    output.innerHTML = modalHtml;
    outputContainer.style.display = "block";

    document.getElementById("save-key-btn").addEventListener("click", () => {
      const apiKey = document.getElementById("api-key-input").value.trim();
      if (!apiKey) {
        document.getElementById("api-key-input").style.borderColor = "#ef4444";
        document.getElementById("api-key-input").style.boxShadow =
          "0 0 0 3px rgba(239, 68, 68, 0.2)";
        return;
      }

      chrome.storage.local.set({ openaiKey: apiKey }, () => {
        output.innerHTML = "";
        output.textContent =
          "API Key saved successfully! You can now optimize your prompt.";
        output.style.color = "var(--success-color)";
        output.style.background = "#ecfdf5";
        output.style.border = "1px solid #a7f3d0";
        output.style.padding = "12px";
        output.style.borderRadius = "8px";

        setTimeout(() => {
          output.innerHTML = "";
          output.style.color = "";
          output.style.background = "";
          output.style.border = "";
          updateButtonState();
        }, 2000);
      });
    });

    document.getElementById("cancel-key-btn").addEventListener("click", () => {
      output.innerHTML = "";
      outputContainer.style.display = "none";
    });
  }
});
