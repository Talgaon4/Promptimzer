// File: background.js

// Constants for models and parameters
const DEFAULT_MODEL = "gpt-3.5-turbo";
const TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 300;

// OpenAI API pricing (per 1K tokens) - update these as needed
const OPENAI_PRICING = {
  "gpt-3.5-turbo": {
    input: 0.0015, // $0.0015 per 1K input tokens
    output: 0.002, // $0.002 per 1K output tokens
  },
  "gpt-4": {
    input: 0.03, // $0.03 per 1K input tokens
    output: 0.06, // $0.06 per 1K output tokens
  },
};

// Add rate limiting configuration
const API_RATE_LIMIT = {
  count: 0,
  resetTime: Date.now() + 60000, // 1 minute window
  limit: 20, // Max 20 calls per minute
};

// Cache for loaded prompt templates
const PROMPTS = {};
const PROMPT_FILES = [
  "classifier",
  "gibberish",
  "casual",
  "simple",
  "complex",
  "agent",
];

// Simple token estimation (rough approximation)
function estimateTokens(text) {
  // Rough estimation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

// Calculate cost for a request
function calculateCost(model, inputTokens, outputTokens) {
  const pricing = OPENAI_PRICING[model] || OPENAI_PRICING["gpt-3.5-turbo"];
  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;
  return {
    inputCost: inputCost,
    outputCost: outputCost,
    totalCost: inputCost + outputCost,
    inputTokens: inputTokens,
    outputTokens: outputTokens,
  };
}

// Lazy-load a prompt file by name
async function loadPrompt(name) {
  if (PROMPTS[name]) return PROMPTS[name];
  if (!PROMPT_FILES.includes(name))
    throw new Error(`Unknown prompt category: ${name}`);
  const url = chrome.runtime.getURL(`prompts/${name}.txt`);
  const text = await fetch(url).then((r) => {
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
  const classifierPrompt = await loadPrompt("classifier");

  // Estimate input tokens
  const inputTokens =
    estimateTokens(classifierPrompt) + estimateTokens(rawPrompt);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        {role: "system", content: classifierPrompt},
        {role: "user", content: rawPrompt},
      ],
      temperature: 0.0,
      max_tokens: 10,
    }),
  });

  if (!res.ok) throw new Error(`Classifier API error ${res.status}`);
  const data = await res.json();

  // Get actual token usage from response
  const usage = data.usage;
  const outputTokens = usage?.completion_tokens || 10;
  const totalInputTokens = usage?.prompt_tokens || inputTokens;

  const cost = calculateCost(DEFAULT_MODEL, totalInputTokens, outputTokens);

  return {
    category: (data.choices[0]?.message?.content || "").trim().toLowerCase(),
    cost: cost,
  };
}

// Optimize prompt based on its category
async function optimizePrompt(rawPrompt, category, apiKey, maxTokens) {
  const useModel = DEFAULT_MODEL;
  const systemPrompt = await loadPrompt(category).catch(() =>
    loadPrompt("simple")
  );
  // Estimate input tokens
  const inputTokens = estimateTokens(systemPrompt) + estimateTokens(rawPrompt);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: useModel,
      messages: [
        {role: "system", content: systemPrompt},
        {role: "user", content: rawPrompt},
      ],
      temperature: TEMPERATURE,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) throw new Error(`Optimizer API error ${res.status}`);
  const data = await res.json();
  const optimized = data.choices[0]?.message?.content?.trim();

  if (!optimized) throw new Error("Empty response from optimizer.");

  // Get actual token usage from response
  const usage = data.usage;
  const outputTokens = usage?.completion_tokens || estimateTokens(optimized);
  const totalInputTokens = usage?.prompt_tokens || inputTokens;

  const cost = calculateCost(useModel, totalInputTokens, outputTokens);

  return {
    optimized: optimized,
    cost: cost,
  };
}

// Main listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== "optimize") return;

  // Fetch API key and optional user setting for max tokens
  chrome.storage.local.get(
    ["openaiKey", "maxTokens"],
    async ({openaiKey, maxTokens}) => {
      if (!openaiKey) {
        sendResponse({error: "No OpenAI API key set in storage."});
        return;
      }

      // Check rate limit before proceeding
      if (!checkRateLimit()) {
        sendResponse({
          error:
            "Rate limit exceeded. Please try again in a minute to protect your API usage.",
          isRateLimited: true,
        });
        return;
      }

      // Determine effective max tokens (use user preference if set, else default)
      const effectiveMaxTokens =
        typeof maxTokens === "number" && maxTokens > 0
          ? maxTokens
          : DEFAULT_MAX_TOKENS;

      try {
        // Classification
        const classificationResult = await classifyPrompt(
          msg.prompt,
          openaiKey
        );
        const category = classificationResult.category;
        const classificationCost = classificationResult.cost;

        console.log(`Prompt classified as: ${category}`);

        // If nonsense, return early and instruct content script to show inline warning
        if (category === "gibberish") {
          const gibberishPrompt = await loadPrompt("gibberish");
          sendResponse({
            optimized: gibberishPrompt,
            category,
            showWarning: true,
            cost: {
              classification: classificationCost || {
                inputCost: 0,
                outputCost: 0,
                totalCost: 0,
                inputTokens: 0,
                outputTokens: 0,
              },
              optimization: {
                inputCost: 0,
                outputCost: 0,
                totalCost: 0,
                inputTokens: 0,
                outputTokens: 0,
              },
              total: {
                inputCost: 0,
                outputCost: 0,
                totalCost: 0,
                inputTokens: 0,
                outputTokens: 0,
              },
            },
          });
          return;
        }

        // Optimization with user-controlled maxTokens
        const optimizationResult = await optimizePrompt(
          msg.prompt,
          category,
          openaiKey,
          effectiveMaxTokens
        );
        const optimized = optimizationResult.optimized;
        const optimizationCost = optimizationResult.cost;

        // Calculate total cost
        const totalCost = {
          classification: classificationCost,
          optimization: optimizationCost,
          total: {
            inputCost:
              classificationCost.inputCost + optimizationCost.inputCost,
            outputCost:
              classificationCost.outputCost + optimizationCost.outputCost,
            totalCost:
              classificationCost.totalCost + optimizationCost.totalCost,
            inputTokens:
              classificationCost.inputTokens + optimizationCost.inputTokens,
            outputTokens:
              classificationCost.outputTokens + optimizationCost.outputTokens,
          },
        };

        console.log(
          `Optimized with model: ${DEFAULT_MODEL}, maxTokens: ${effectiveMaxTokens}`
        );
        console.log(`Total cost: $${totalCost.total.totalCost.toFixed(4)}`);

        sendResponse({
          optimized,
          category,
          cost: totalCost,
        });
      } catch (err) {
        console.error("Background error:", err);
        sendResponse({error: err.message || "Unknown background error"});
      }
    }
  );

  return true; // Keep the message channel open
});
