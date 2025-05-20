# Promptimizer - AI Prompt Optimization Chrome Extension

Promptimizer is a Chrome extension that enhances your AI chat experience by helping you optimize prompts for platforms like ChatGPT, Claude, and Google Gemini. Get better responses from AI models by refining your prompts with just one click.

## Features

- **One-Click Optimization**: Add an "Optimize Prompt" button to popular AI chat interfaces
- **Smart Classification**: Automatically detects prompt type and applies appropriate optimization strategies
- **Multi-Platform Support**: Works with ChatGPT, Claude, Google Gemini, and more
- **Privacy-Focused**: Your data never leaves your browser except for OpenAI API calls with your own key
- **Customizable Settings**: Control maximum token usage to manage your API costs
- **Rate Limiting**: Built-in protection to prevent excessive API usage
- **Quick Access Popup**: Optimize prompts without visiting AI platforms

## Installation

1. **Chrome Web Store** (Coming Soon)
   - Navigate to the Chrome Web Store
   - Search for "Promptimizer"
   - Click "Add to Chrome"

2. **Manual Installation** (Developer Mode)
   - Download or clone this repository
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top-right corner
   - Click "Load unpacked" and select the downloaded folder

## Usage

### In AI Chat Interfaces

1. Navigate to any supported AI chat platform (ChatGPT, Claude, Google Gemini)
2. Look for the "Optimize Prompt" button near the text input area
3. Type your prompt in the input field
4. Click the "Optimize Prompt" button
5. The optimized prompt will replace your original text

### Using the Popup

1. Click the Promptimizer icon in your Chrome toolbar
2. Enter your prompt in the text area
3. Click "Optimize Prompt"
4. Copy the optimized result to your clipboard with the copy button

## Configuration

1. Click the Promptimizer icon in your Chrome toolbar
2. Click "Settings" to open the options page
3. Enter your OpenAI API key (required for optimization)
4. Set your preferred maximum token limit (controls response length and API costs)
5. Click "Save Settings"

## Privacy

Promptimizer is designed with privacy in mind:

- Your OpenAI API key is stored locally on your device using Chrome's secure storage
- No user data is stored on external servers
- Your prompts are only sent to OpenAI when you explicitly click "Optimize"
- All settings and configurations are stored locally

For more details, see the [Privacy Policy](PRIVACY.md) included in this repository.

## How It Works

Promptimizer uses a two-step process for optimization:

1. **Classification**: First, it analyzes your prompt to determine its category (casual conversation, complex query, agent instructions, etc.)
2. **Optimization**: Then it applies category-specific improvements to enhance clarity, structure, and effectiveness

## Development

### Project Structure

```
├── background.js         # Service worker with core logic
├── content_script.js     # Injects UI elements into chat interfaces
├── manifest.json         # Extension configuration
├── options.html/js/css   # Settings page
├── popup.html/js         # Quick access popup
├── prompts/              # Category-specific optimization templates
│   ├── agent.txt
│   ├── casual.txt
│   ├── classifier.txt
│   ├── complex.txt
│   ├── gibberish.txt
│   └── simple.txt
├── styles.css            # Shared styles
└── PRIVACY.md            # Privacy policy
```

### Requirements

- OpenAI API key (for prompt optimization)
- Chrome browser

## License

This project is open source. Feel free to modify and distribute according to the terms of the license.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Note**: This extension requires an OpenAI API key to function. Usage of the OpenAI API may incur charges based on your account plan.
