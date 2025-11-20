# Bloom Scroll 📵

Control your LinkedIn and Twitter (X) feeds with an AI of your choice. Bloom Scroll is a Chrome extension that filters out low‑value, click‑bait, promotional and off‑topic posts on your LinkedIn and Twitter/X feeds. It uses AI to analyse posts in real time and hides content that doesn’t meet your quality criteria.

This project demonstrates how AI can empower you to control the content you consume.

> [!TIP]
> 🎉 New: Mute Words – automatically filter posts containing specific words!

## Supported Sites

- LinkedIn feed: `https://www.linkedin.com/feed/*`
- Twitter/X: `https://twitter.com/*`, `https://x.com/*`

## How it works

Bloom Scroll filters out low‑value content from your LinkedIn or Twitter/X feed using an AI model. When you browse either site:

1. **Detects New Posts**: As new posts appear in your feed, the extension detects them in real time.
2. **Sends for Analysis**: The post content is sent to an AI provider (via API) that classifies it based on your active filters.
3. **Filters Content**: Posts identified as low‑value are filtered according to your preferred mode:
   - Blur Mode: Blurs cringe until you decide (with a "Click to View" option)
   - Vanish Mode: Vanish cringe completely from your feed
4. **User Control**: Configure everything in the Settings page – API key, filter toggles, muted words, and an optional custom system prompt.

Filtering settings are shared across both LinkedIn and Twitter/X; only the scraping logic differs per site.

## Running Bloom Scroll Locally

To run the Bloom Scroll Chrome extension locally:

- Clone the repository.
- Load the extension in Chrome: go to `chrome://extensions/`, enable Developer Mode, and click “Load unpacked”.
- Select the folder containing the extension files.
- Open the extension Settings page to add your API key, adjust filters, and set muted words.
- Open Chrome browser and navigate to the Extensions page by typing `chrome://extensions/` in the URL bar.
- Enable Developer Mode in the top-right corner.
- Click on the Load unpacked button.
- Select the folder where the extension files are located (`bloom-scroll` folder).
