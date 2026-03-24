# IntelliSave

<p align="center">
  <img src="assets/logo.png" alt="IntelliSave logo" width="120" />
</p>

<p align="center">
  Smart download organization for Chrome.
</p>

IntelliSave automatically sorts downloaded files into the right folders based on file type and website source, helping keep your downloads organized without interrupting your workflow.

## Install

Install IntelliSave from the [Chrome Web Store](https://chromewebstore.google.com/detail/intellisave/knemlapnohmfinjfondkjhdnoahfafko).

## Key Features

- Automatically routes downloads into the right folders
- Supports website-specific rules for the same file type
- Learns from your save behavior and suggests new rules
- Lets you customize categories and preferences
- Keeps a clean history of organized downloads

## How It Works

1. When you download a file, IntelliSave checks the source website and file type.
2. If a matching rule exists, Chrome opens directly to the appropriate folder or saves there automatically, depending on your download settings.
3. If no site-specific rule exists, IntelliSave falls back to the file type category.
4. If you save a file somewhere new, IntelliSave can suggest creating a rule for future downloads.

Example use case:
You download a `.zip` from `freepik.com`, so IntelliSave can route it to `Graphics`. Later, you download a `.zip` from `fonts.google.com`, and IntelliSave can learn to send that to `Fonts` instead. The same file type can go to different folders depending on where it came from.

For the best experience, Chrome's `Ask where to save each file before downloading` setting can be enabled. IntelliSave also works with automatic saving when that setting is off.

## Privacy

IntelliSave does not collect, transmit, or sell personal data. Download rules and preferences stay in the browser.

Read the full policy in [privacy.html](privacy.html).

## Development

To run IntelliSave locally:

1. Clone this repository.
2. Open `chrome://extensions/` in Chrome.
3. Enable Developer mode.
4. Click `Load unpacked`.
5. Select this project folder.

## Support

Questions or feedback: [xabisomemanii@gmail.com](mailto:xabisomemanii@gmail.com)

## License

[MIT](LICENSE)
