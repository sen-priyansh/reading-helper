# Reading Helper Chrome Extension

Reading Helper is a simple Chrome extension that allows users to quickly get the meaning, definition, or a brief explanation of any selected text (word, sentence, or paragraph) on a webpage using the Gemini API. The meaning is displayed in a floating box directly on the page for instant feedback.

## Features

* **Context Menu Integration**: Right-click on any selected text to instantly get its meaning.
* **On-Page Display**: The meaning is displayed in a clear, dismissible floating box directly on the webpage, eliminating the need to open a separate popup.
* **Gemini API Powered**: Leverages the power of Google's Gemini API for accurate and relevant explanations.
* **Flexible Design**: Built with flexibility in mind to easily add more functionalities in the future.
* **Comprehensive Logging**: Includes console logs for easier debugging and understanding of the extension's flow.

## Installation

1.  **Download the Extension Files**:
    * Create a new folder named `reading-helper`.
    * Save the following files into this `reading-helper` folder:
        * `manifest.json`
        * `content.js`
        * `background.js`
        * `README.md` (this file)
        * `LICENSE`
    * **Note**: The `popup.html` and `popup.js` files are no longer used by this version of the extension and can be removed if they exist.
    * Inside the `reading-helper` folder, create another folder named `icons`.
    * Place your 16x16, 48x48, and 128x128 pixel icon images (e.g., `icon16.png`, `icon48.png`, `icon128.png`) inside the `icons` folder.

2.  **Get a Gemini API Key**:
    * Go to the Google AI Studio: [https://aistudio.google.com/](https://aistudio.google.com/)
    * Generate a new API key.
    * **IMPORTANT**: Open `background.js` and locate the line `const apiKey = "";`. Replace the empty string with your actual Gemini API key.
        ```javascript
        const apiKey = "YOUR_GEMINI_API_KEY_HERE"; // Example: "AIzaSyC0s-..."
        ```

3.  **Load the Extension in Chrome**:
    * Open Chrome and go to `chrome://extensions`.
    * Enable **Developer mode** by toggling the switch in the top right corner.
    * Click on the **Load unpacked** button.
    * Select the `reading-helper` folder you created.

4.  **Pin the Extension (Optional but Recommended)**:
    * Click on the puzzle piece icon next to your Chrome profile picture (top right corner of Chrome).
    * Find "Reading Helper" and click the pin icon next to it to pin it to your toolbar for easy access.

## Usage

1.  **Navigate to any webpage.**
2.  **Select a word, sentence, or a short paragraph** that you want to understand.
3.  **Right-click** on the selected text.
4.  From the context menu, click on **"Get Meaning with Reading Helper"**.
5.  A floating box will appear on the top-right of the current webpage displaying the selected text and its meaning. You can click the '$\times$' button to close it.

## Debugging

If you encounter any issues, you can check the console logs:

* **For `background.js` logs**: Go to `chrome://extensions`, find "Reading Helper", and click on "Inspect views: service worker".
* **For `content.js` logs**: Open the Developer Tools (F12 or Ctrl+Shift+I / Cmd+Option+I) on the webpage where you are using the extension, and navigate to the "Console" tab.

## Future Enhancements

The current structure is designed to be easily extendable. Here are some ideas for future functionalities you might consider adding:

* **Offline Caching**: Store frequently looked-up meanings locally.
* **Language Translation**: Integrate translation capabilities.
* **Pronunciation Guide**: Add audio pronunciation for words.
* **Synonyms/Antonyms**: Provide related words.
* **History**: Keep a log of previously looked-up texts.
* **Settings Page**: Allow users to customize API keys, preferred languages, font sizes, or default display positions.
* **More Advanced UI**: Make the meaning box draggable or resizable.

## License

This project is licensed under a custom license that prohibits commercial use without explicit permission. Please refer to the `LICENSE` file for full details on usage permissions.
