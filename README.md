# Reading Helper Chrome Extension 📚

A powerful Chrome extension that enhances your reading experience with AI-powered text analysis, highlighting, and focus tools.

## ✨ Features

### 🎯 Quick Action Hover Card
When you select text on any webpage, a convenient hover card appears with instant action buttons:
- **🎨 Highlight/Unhighlight** - Permanently highlight text with color
- **🔍 Web Search** - Search for meaning and definitions online  
- **📖 Get Meaning** - Get AI-powered explanations using Gemini API
- **🔤 Make Bold** - Apply bold formatting to text
- **🌟 Increase Contrast** - Enhance text readability with high contrast

### 🧰 Comprehensive Toolbox
Click the extension icon to access the Reading Helper Toolbox:

#### Focus & Navigation
- **🎯 Focus Mode** - Create a focus box to concentrate on specific areas
- **❌ Clear Selection** - Remove current text selection

#### Quick Actions  
- **🌟 Show All Highlights** - Flash all highlighted text on the page
- **📄 Export Highlights** - Download all highlights as a text file
- **🗑️ Clear All Highlights** - Remove all highlights from current page

#### Highlight Management
- **📊 Highlight Counter** - Shows total number of highlights
- **📝 Highlight List** - Browse and navigate through all highlighted text
- **⚡ Quick Jump** - Click any highlight to scroll to it instantly

### 💾 Persistent Storage
- Highlights are saved across browser sessions
- Per-page highlight management  
- Export functionality for backup and sharing

## 🚀 Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. Add your Gemini API key to a local `secrets.json` file (see below)

## 🔧 Setup

### Gemini API Key (keep it private)
1. Get your API key from Google AI Studio: https://makersuite.google.com/app/apikey
2. Create a new file in the extension folder named `secrets.json` (this file is ignored by git).
3. Paste your key in this format:

```json
{
   "GEMINI_API_KEY": "YOUR_REAL_API_KEY"
}
```

Notes:
- `secrets.json` is listed in `.gitignore`, so it won’t be committed to the public repo.
- Alternatively, you can set the key at runtime via DevTools:

```js
// In the service worker console (chrome://extensions → Inspect views → Service Worker)
chrome.storage.local.set({ GEMINI_API_KEY: 'YOUR_REAL_API_KEY' })
```

The extension loads the key from `secrets.json` first, then falls back to `chrome.storage.local`.

## 📖 How to Use

### Text Selection & Quick Actions
1. **Select any text** on a webpage
2. **Hover card appears** with action buttons
3. **Click desired action**:
   - Highlight with color
   - Search web for meaning
   - Get AI explanation  
   - Apply bold formatting
   - Increase text contrast

### Using the Toolbox
1. **Click extension icon** in browser toolbar
2. **Access tools**:
   - Enable focus mode for distraction-free reading
   - View all highlights on current page
   - Export highlights to file
   - Jump to specific highlighted text

### Context Menu (Legacy)
- **Right-click selected text** → "Get Meaning with Reading Helper"
- AI-powered meaning appears in floating box

## 🔒 Permissions

The extension requires these permissions:
- **activeTab** - Access current webpage content
- **contextMenus** - Add right-click menu options  
- **scripting** - Inject content scripts for functionality
- **storage** - Save highlights persistently
- **tabs** - Open new tabs for web search
- **downloads** - Export highlights as files

## 🎨 Customization

### Highlight Colors
Edit `content.css` to change highlight colors:
```css
.reading-helper-highlight {
    background-color: #your-color !important;
}
```

### Hover Card Position
Modify hover card positioning in `content.js`:
```javascript
const x = rect.left + (rect.width / 2) - 75; // Horizontal position  
const y = rect.top + window.scrollY; // Vertical position
```

## 🐛 Troubleshooting

### Hover Card Not Appearing
- Ensure text is properly selected
- Check browser console for errors
- Verify content script is loaded

### Highlights Not Saving  
- Check if storage permission is granted
- Verify Chrome storage quota
- Try refreshing the page

### Gemini API Not Working
- Verify API key is correctly set
- Check API quota limits
- Ensure internet connection

## 📁 File Structure

```
reading-helper/
├── manifest.json          # Extension configuration
├── background.js           # Service worker & API handling  
├── content.js             # Page interaction & UI
├── content.css            # Styling for content elements
├── popup.html             # Toolbox interface
├── popup.js               # Toolbox functionality
├── icons/                 # Extension icons
└── README.md              # Documentation
```

## 🔄 Version History

### v2.0 (Current)
- ✅ Interactive hover card with quick actions
- ✅ Comprehensive toolbox popup
- ✅ Persistent highlight system
- ✅ Focus mode for distraction-free reading  
- ✅ Export/import highlight functionality
- ✅ Enhanced text styling options

### v1.0
- ✅ Basic meaning lookup with Gemini API
- ✅ Context menu integration
- ✅ Simple floating meaning box

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes  
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Google Gemini AI for meaning generation
- Chrome Extensions API for platform integration
- Icons from various open source projects

---

**Happy Reading! 📚✨**