// File: background.js

// Constants for models and parameters
const DEFAULT_MODEL = 'gpt-3.5-turbo';
const TEMPERATURE   = 0.2;
const DEFAULT_MAX_TOKENS = 300;

// Add rate limiting configuration
const API_RATE_LIMIT = {
  count: 0,
  resetTime: Date.now() + 60000, // 1 minute window
  limit: 20 // Max 20 calls per minute
};

// Cache for loaded prompt templates
const PROMPTS = {};
const PROMPT_FILES = [
  'classifier',
  'nonsense',
  'simple',
  'complex',
];

// Lazy-load a prompt file by name
async function loadPrompt(name) {
  if (PROMPTS[name]) return PROMPTS[name];
  if (!PROMPT_FILES.includes(name)) throw new Error(`Unknown prompt category: ${name}`);
  const url = chrome.runtime.getURL(`prompts/${name}.txt`);
  const text = await fetch(url).then(r => {
    if (!r.ok) throw new Error(`Failed to load ${name}.txt`);
    return r.text();
  });
  PROMPTS[name] = text.trim();
  return PROMPTS[name];
}

// Checks if the current request is within rate limits
function checkRateLimit() {
  const now = Date.now();
  
  // Reset counter if we're in a new time window
  if (now > API_RATE_LIMIT.resetTime) {
    API_RATE_LIMIT.count = 0;
    API_RATE_LIMIT.resetTime = now + 60000; // Reset for next minute
  }
  
  // Check if we're over the limit
  if (API_RATE_LIMIT.count >= API_RATE_LIMIT.limit) {
    return false; // Rate limit exceeded
  }
  
  // Increment counter and return success
  API_RATE_LIMIT.count++;
  return true; // Within rate limit
}

// Classify raw prompt into categories
async function classifyPrompt(rawPrompt, apiKey) {
  const classifierPrompt = await loadPrompt('classifier');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: classifierPrompt },
        { role: 'user', content: rawPrompt }
      ],
      temperature: 0.0,
      max_tokens: 10
    })
  });

  if (!res.ok) throw new Error(`Classifier API error ${res.status}`);
  const data = await res.json();
  return (data.choices[0]?.message?.content || '').trim().toLowerCase();
}

// Optimize prompt based on its category
async function optimizePrompt(rawPrompt, category, apiKey, maxTokens) {
  const useModel = DEFAULT_MODEL;
  const systemPrompt = await loadPrompt(category).catch(() => loadPrompt('simple'));

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: useModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: rawPrompt }
      ],
      temperature: TEMPERATURE,
      max_tokens: maxTokens
    })
  });

  if (!res.ok) throw new Error(`Optimizer API error ${res.status}`);
  const data = await res.json();
  const optimized = data.choices[0]?.message?.content?.trim();

  if (!optimized) throw new Error('Empty response from optimizer.');
  return optimized;
}

// Main listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'optimize') return;

  // Fetch API key and optional user setting for max tokens
  chrome.storage.local.get(['openaiKey', 'maxTokens'], async ({ openaiKey, maxTokens }) => {
    if (!openaiKey) {
      sendResponse({ error: 'No OpenAI API key set in storage.' });
      return;
    }

    // Check rate limit before proceeding
    if (!checkRateLimit()) {
      sendResponse({ 
        error: 'Rate limit exceeded. Please try again in a minute to protect your API usage.',
        isRateLimited: true 
      });
      return;
    }

    // Determine effective max tokens (use user preference if set, else default)
    const effectiveMaxTokens = (typeof maxTokens === 'number' && maxTokens > 0)
      ? maxTokens
      : DEFAULT_MAX_TOKENS;

    try {
      // Classification
      const category = await classifyPrompt(msg.prompt, openaiKey);
      console.log(`Prompt classified as: ${category}`);

      // If nonsense, return early and instruct content script to show inline warning
      if (category === 'nonsense') {
        sendResponse({ optimized: msg.prompt, category, showWarning: true });
        return;
      }

      // Optimization with user-controlled maxTokens
      const optimized = await optimizePrompt(msg.prompt, category, openaiKey, effectiveMaxTokens);
      console.log(`Optimized with model: ${DEFAULT_MODEL}, maxTokens: ${effectiveMaxTokens}`);

      sendResponse({ optimized, category });
    } catch (err) {
      console.error('Background error:', err);
      sendResponse({ error: err.message || 'Unknown background error' });
    }
  });

  return true; // Keep the message channel open
});