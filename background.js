// File: background.js

// Cache for loaded prompt templates
const PROMPTS = {};
const PROMPT_FILES = ['classifier', 'gibberish', 'casual', 'simple', 'complex', 'agent'];

async function loadAllPrompts() {
  // if already loaded, skip
  if (PROMPTS.classifier) return;
  await Promise.all(
    PROMPT_FILES.map(async name => {
      const url = chrome.runtime.getURL(`prompts/${name}.txt`);
      const text = await fetch(url).then(r => {
        if (!r.ok) throw new Error(`Failed to load ${name}.txt`);
        return r.text();
      });
      PROMPTS[name] = text.trim();
    })
  );
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'optimize') return;

  chrome.storage.local.get(
    ['openaiKey', 'model', 'temperature', 'maxTokens'],
    ({ openaiKey, model: defaultModel, temperature: defaultTemp, maxTokens }) => {

      if (!openaiKey) {
        sendResponse({ error: 'No OpenAI API key set in storage.' });
        return;
      }

      // ensure prompts are loaded
      (async () => {
        try {
          await loadAllPrompts();

          const model = msg.model || defaultModel || 'gpt-3.5-turbo';
          const temperature = msg.temperature != null
            ? msg.temperature
            : (defaultTemp != null ? defaultTemp : 0.7);
          const tokenLimit = maxTokens || 300;

          // 1) Classification call
          const clsRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: PROMPTS.classifier },
                { role: 'user', content: msg.prompt }
              ],
              temperature: 0.0,
              max_tokens: 10
            })
          });
          if (!clsRes.ok) throw new Error(`Classifier API error ${clsRes.status}`);
          const clsData = await clsRes.json();
          const category = (clsData.choices[0]?.message?.content || '').trim().toLowerCase();

          // pick appropriate system prompt
          const systemPrompt = PROMPTS[category] || PROMPTS.simple;

          // 2) Optimization call
          const optRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: msg.prompt }
              ],
              temperature,
              max_tokens: tokenLimit
            })
          });
          if (!optRes.ok) throw new Error(`Optimizer API error ${optRes.status}`);
          const optData = await optRes.json();
          const optimized = optData.choices[0]?.message?.content?.trim();

          if (!optimized) {
            sendResponse({ error: 'Empty response from optimizer.' });
          } else {
            sendResponse({ optimized });
          }

        } catch (err) {
          console.error('Prompt Refiner background error:', err);
          sendResponse({ error: err.message || 'Unknown background error' });
        }
      })();

    }
  );

  // indicate we’ll call sendResponse asynchronously
  return true;
});
