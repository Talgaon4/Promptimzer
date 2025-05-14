chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'optimize') return;

  chrome.storage.local.get('openaiKey', async ({openaiKey}) => {
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
            { role: 'system', content: 'You are a prompt optimization assistant.' },
            { role: 'user', content: `Optimize this prompt for clarity and impact:\n\n${msg.prompt}` }
          ],
          temperature: msg.temperature,
          max_tokens: 300
        })
      });
      
      if (!apiRes.ok) {
        const errorData = await apiRes.json().catch(() => ({}));
        let errorMessage;
        
        // Check for API key-related errors
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

  // This is crucial for async response handling
  return true;
});