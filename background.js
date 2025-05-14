// File: background.js

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'optimize') return;

  chrome.storage.local.get('openaiKey', async ({ openaiKey }) => {
    if (!openaiKey) {
      sendResponse({ error: 'No OpenAI API key set in storage.' });
      return;
    }

    try {
      const apiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: msg.model,
          messages: [
            {
              role: 'system',
              content: `
You are a prompt-optimization assistant for conversational LLMs. Your job is to take casual, typo-ridden, or unclear user prompts and rewrite them to be:

• Clear and concise  
• Grammatically correct  
• Preserving the original intent and tone (e.g. casual remains casual)  
• Structured to get the best possible answer from an LLM  

Here are some examples:

Example 1  
• User’s original: “tell me what is the weather like now”  
• Optimized: “What’s the current weather forecast in my location?”

Example 2  
• User’s original: “i need help with my resume grammar and style”  
• Optimized: “Please review my resume and improve its grammar and style.”

Example 3  
• User’s original: “whats the best way to learn js quickly?”  
• Optimized: “What are the most effective strategies and resources for learning JavaScript quickly?”

Now, given the user’s prompt below, output *only* the optimized version:
`
            },
            {
              role: 'user',
              content: msg.prompt
            }
          ],
          temperature: msg.temperature,
          max_tokens: 300
        })
      });

      if (!apiRes.ok) {
        const errorData = await apiRes.json().catch(() => ({}));
        let errorMessage;

        if (errorData.error?.message?.includes('API key')) {
          errorMessage = errorData.error.message;
        } else if (apiRes.status === 401) {
          errorMessage = 'Invalid API key or authentication error.';
        } else {
          errorMessage = errorData.error?.message || `API returned status ${apiRes.status}`;
        }

        console.error('OpenAI API error:', errorData);
        sendResponse({ error: errorMessage });
        return;
      }

      const data = await apiRes.json();

      if (!data.choices || !data.choices.length) {
        sendResponse({ error: 'No choices returned from API' });
        return;
      }

      const optimized = data.choices[0]?.message?.content?.trim();

      if (!optimized) {
        sendResponse({ error: 'Empty response from API' });
        return;
      }

      sendResponse({ optimized });

    } catch (err) {
      console.error('Prompt Refiner background error', err);
      sendResponse({ error: err.message || 'Unknown error in background script' });
    }
  });

  // Indicate that we'll respond asynchronously
  return true;
});
