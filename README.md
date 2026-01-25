# IntelliSave - Smart Download Organizer

A Chrome extension that automatically organizes your downloads into folders based on the website and file type. Made for designers, by a designer.

## Features

- **Automatic Sorting**: Files are saved to predefined folders like "Photos", "Documents", "Archives", "Vectors", etc. based on file type

- **Website Specific Rules**: Save `.zip` files from freepik.com to "Graphics" folder but `.zip` from fonts.google.com to "Fonts" folder
- **Smart Learning**: Learns from your "Save As" choices and suggests new rules, that you may confirm or ignore
- **Customizable**: Add your own websites and file type categories to be auto saved
- **Clean History**: View all your organized downloads in one place

## How It Works

1. **When you download a file**, IntelliSave checks:
   - Which website it's from (for example: `freepik.com`)
   - What file type it is (example: `.zip`)
   - If there's a rule for that website + file type

2. **If there a rule exists already**, it opens the save dialogue to that specified folder matching the rule (example: `.zip → "IntelliSave/Graphics/"`)

3. **If no rule exists**, it uses the file type to determine where to save this file (example: a `.zip → "IntelliSave/Archives/"`)

4. **If you save to a different folder**, it asks if you want to create/update a rule for next time. (So it will open `.zip → "IntelliSave/Archives/"` then you may navigate to a different a different folder. A notification asking if youd like to confirm this new rule will pop up and if you click "Yes", that rule new it will be added and the next download from that type + website will be automatically saved according to the rule. For example `.zip` from `fonts.google.com  → "IntelliSave/Fonts/"` instead of `"IntelliSave/Archives/"` where it would normally be saved.)

- This is assuming "`Ask where to save each file before downloading`" setting in Chrome is toggled on.
  If it is then saving any file opens save dialogue to that specific folder, if its not toggled on then the files are automatically saved in the folder. Saving you the trouble of navigating folder to folder to save different files at a time!

## Installation

1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the project folder

## Project Structure

```
intellisave/
├── manifest.json   # Config file for extention
├── background.js   # Main logic (download handling, auto-learning)
├── options.html    # Settings page
├── options.js      # Settings page logic
├── popup.html      # Browser popup
├── popup.js        # Popup logic
├── styles/
│   ├── shared.css  # Shared styles
│   ├── options.css # Settings page styles
│   └── popup.css   # Popup styles
└── assets/         # Icons and images
```

## For Developers

### Technologies Used

- **JavaScript**: Handles all the logic, rules, and user interactions throughout the extension.
- **CSS**: Custom styles for the popup and settings pages, focused on a clean and modern user experience.
- **HTML**: Provides the structure for the popup and options UI, designed for clarity and ease of use.

### 1. Storage System

- `chrome.storage.sync`: Saves user settings (rules, categories, preferences)
- `chrome.storage.local`: Temporary storage for current downloads

### 2. Rules Priority

1. Website specific rules (highest priority)
2. File type categories
3. Default download location (no rule)

### 3. Auto-Learning Flow

1. User saves file to different folder than suggested
2. Extension detects the difference
3. Shows notification asking to create/update rule
4. If user agrees, saves new rule
5. Future downloads use the new rule

**Note about preview vs installed behavior:** If you open `options.html` in a local preview or editor (for example, VS Code Live Preview) the Chrome extension APIs (`chrome.storage`, `chrome.downloads`, etc.) are not available. In that case the Options UI may not show stored preferences. When you load the unpacked extension into Chrome the `onInstalled` logic runs and default site rules and file categories are populated automatically, so new users will see the preconfigured categories (Apps, Code, Photos, etc.) on first install.

## Collaboration?

This extention is part of my professional work, built to showcase my skills in frontend development, UX design, and creative problem-solving.

I'm always open to feedback, especially from fellow developers, designers, or anyone interested in modern web development and UX design.
