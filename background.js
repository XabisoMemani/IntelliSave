// IntelliSave - Smart Download Organizer
// Organizes downloads into folders based on website and file type

// ============================================================================
// 1. DEFAULT SETTINGS
// ============================================================================

// Pre-defined rules for popular websites
const DEFAULT_SITE_RULES = {
  "dafont.com": { zip: "Fonts", ttf: "Fonts", otf: "Fonts" },
  "fonts.google.com": {
    zip: "Fonts",
    ttf: "Fonts",
    otf: "Fonts",
    woff: "Fonts",
    woff2: "Fonts",
  },
  "fontsquirrel.com": { zip: "Fonts", ttf: "Fonts", otf: "Fonts" },
  "1001fonts.com": { zip: "Fonts", ttf: "Fonts", otf: "Fonts" },

  "pinterest.com": { jpg: "Photos", png: "Photos", webp: "Photos" },
  "i.pinimg.com": { jpg: "Photos", png: "Photos" },

  "elements.envato.com": {
    zip: "Graphics",
    png: "Photos",
    jpg: "Photos",
    psd: "Graphics",
    ai: "Vectors",
  },
  "graphicriver.net": { zip: "Graphics", psd: "Graphics" },
  "freepik.com": {
    zip: "Graphics",
    png: "Photos",
    jpg: "Photos",
    svg: "Vectors",
    psd: "Graphics",
  },

  "unsplash.com": { jpg: "Photos", png: "Photos" },
  "pexels.com": { jpg: "Photos", png: "Photos" },
  "pixabay.com": { jpg: "Photos", png: "Photos" },

  "flaticon.com": { png: "Icons", svg: "Icons" },
  "iconfinder.com": { png: "Icons", svg: "Icons" },

  "vectorstock.com": { svg: "Vectors", ai: "Vectors", eps: "Vectors" },
  "vecteezy.com": { svg: "Vectors", ai: "Vectors" },
};

// Default file type categories
const DEFAULT_FILE_TYPES = {
  Photos: ["jpg", "jpeg", "png", "webp", "bmp", "tiff"],
  Vectors: ["svg", "ai", "eps", "ico", "icns"],
  Graphics: ["psd", "sketch", "xd", "fig"],
  Fonts: ["ttf", "otf", "woff", "woff2", "eot"],
  Videos: ["mp4", "mov", "avi", "webm", "mkv", "flv"],
  GIFs: ["gif"],
  Documents: ["pdf", "doc", "docx", "txt", "rtf", "odt"],
  Archives: ["zip", "rar", "7z", "tar", "gz"],
  Audio: ["mp3", "wav", "aac", "flac", "ogg", "m4a"],
  Code: ["html", "css", "js", "json", "xml", "py", "java", "cpp"],
  Apps: ["exe", "msi", "dmg", "pkg", "deb", "rpm"],
};

// ============================================================================
// 2. INITIALIZATION
// ============================================================================

// Run when extension is installed or updated
chrome.runtime.onInstalled.addListener(async () => {
  console.log("IntelliSave: Extension installed/updated");

  // Get current settings
  const settings = await chrome.storage.sync.get([
    "extensionEnabled",
    "siteRules", // Changed from "domainHints" to clearer name
    "learningEnabled",
    "fileCategories",
  ]);

  const updates = {};

  // Set default values if not exist
  if (typeof settings.extensionEnabled !== "boolean") {
    updates.extensionEnabled = true;
  }
  if (typeof settings.learningEnabled !== "boolean") {
    updates.learningEnabled = true;
  }

  // Merge site rules (add new defaults without deleting user rules)
  const currentRules = settings.siteRules || {};
  let rulesChanged = false;

  for (const [site, rules] of Object.entries(DEFAULT_SITE_RULES)) {
    if (!currentRules[site]) {
      currentRules[site] = rules;
      rulesChanged = true;
    }
  }

  if (rulesChanged || !settings.siteRules) {
    updates.siteRules = currentRules; // Changed from "domainHints"
  }

  // Merge file categories
  const currentCategories = settings.fileCategories || {};
  let categoriesChanged = false;

  for (const [category, extensions] of Object.entries(DEFAULT_FILE_TYPES)) {
    if (!currentCategories[category]) {
      currentCategories[category] = extensions;
      categoriesChanged = true;
    }
  }

  if (categoriesChanged || !settings.fileCategories) {
    updates.fileCategories = currentCategories;
  }

  // Initialize other settings
  if (!settings.declinedSuggestions) updates.declinedSuggestions = {};
  if (!settings.seenDownloads) updates.seenDownloads = {};

  // Save updates if any
  if (Object.keys(updates).length > 0) {
    await chrome.storage.sync.set(updates);
    console.log("IntelliSave: Settings initialized");
  }
});

// ============================================================================
// 3. MAIN DOWNLOAD HANDLER
// ============================================================================

// Listen for when Chrome is about to download a file
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  handleDownload(downloadItem, suggest);
  return true; // Keep listening
});

async function handleDownload(downloadItem, suggest) {
  // Get extension settings
  const settings = await chrome.storage.sync.get([
    "extensionEnabled",
    "siteRules", // Changed from "domainHints"
    "fileCategories",
  ]);

  // If extension is turned off, use default download location
  if (!settings.extensionEnabled) {
    suggest();
    return;
  }

  // Get download info
  const sourceUrl = await getSourceUrl(downloadItem);
  const website = getWebsiteFromUrl(sourceUrl);
  const fileExtension = getFileExtension(downloadItem.filename).toLowerCase();

  console.log(
    `Download: ${downloadItem.filename} from ${website} (.${fileExtension})`,
  );

  // Step 1: Check for website-specific rule (highest priority)
  let targetFolder = null;
  let matchedWebsite = null;

  if (website) {
    // Check exact website match
    if (
      settings.siteRules[website] &&
      settings.siteRules[website][fileExtension]
    ) {
      targetFolder = settings.siteRules[website][fileExtension];
      matchedWebsite = website;
    }
    // Check for subdomain matches (e.g., sub.example.com matches example.com rules)
    else {
      for (const [ruleWebsite, rules] of Object.entries(settings.siteRules)) {
        if (website.endsWith(`.${ruleWebsite}`) || website === ruleWebsite) {
          if (rules[fileExtension]) {
            targetFolder = rules[fileExtension];
            matchedWebsite = ruleWebsite;
            break;
          }
        }
      }
    }
  }

  // Step 2: If no website rule, check file type categories
  if (!targetFolder) {
    const categories = settings.fileCategories || DEFAULT_FILE_TYPES;

    for (const [category, extensions] of Object.entries(categories)) {
      if (extensions.includes(fileExtension)) {
        targetFolder = category;
        break;
      }
    }
  }

  // Step 3: Route the file to the right folder
  if (targetFolder) {
    const newPath = `IntelliSave/${targetFolder}/${downloadItem.filename}`;
    console.log(`Routing to: ${newPath}`);

    // Remember what we suggested for learning later
    await chrome.storage.local.set({
      [`suggested_${downloadItem.id}`]: {
        suggestedPath: newPath,
        website: website,
        extension: fileExtension,
        folder: targetFolder,
        matchedWebsite: matchedWebsite,
      },
    });

    // Tell Chrome where to save the file
    suggest({ filename: newPath, conflictAction: "uniquify" });
  } else {
    // No rule found, use default location
    console.log("No rule found, using default location");
    suggest();
  }
}

// ============================================================================
// 4. AUTO-LEARNING SYSTEM (FIXED VERSION)
// ============================================================================

// Listen for when downloads complete
chrome.downloads.onChanged.addListener(async (change) => {
  // Only run when download finishes
  if (change.state?.current !== "complete") return;

  // Check if learning is enabled
  const settings = await chrome.storage.sync.get("learningEnabled");
  if (!settings.learningEnabled) return;

  // Get download details
  const downloads = await chrome.downloads.search({ id: change.id });
  if (!downloads || downloads.length === 0) return;

  const download = downloads[0];

  // Check for learning opportunities
  await checkForLearning(download);
});

// Inspect a completed download for possible new/updated rules (auto-learning)
async function checkForLearning(download) {
  // Get download info
  const sourceUrl = download.referrer || download.finalUrl || download.url;
  const website = getWebsiteFromUrl(sourceUrl);
  const fileExtension = getFileExtension(download.filename).toLowerCase();
  const actualPath = download.filename;

  if (!website || !fileExtension) return;

  // Extract folder user actually saved to
  const actualFolder = getFolderFromPath(actualPath);
  const folderName = extractFolderName(actualFolder);

  // Check if we suggested a path for this download
  const suggestionKey = `suggested_${download.id}`;
  const suggestionData = await chrome.storage.local.get(suggestionKey);
  const suggestion = suggestionData[suggestionKey];

  // If user used our suggestion, no learning needed
  if (suggestion) {
    const suggestedPath = suggestion.suggestedPath.replace(/\\/g, "/");
    const actualPathNormalized = actualPath.replace(/\\/g, "/");

    // Check if user followed our suggestion
    if (actualPathNormalized.includes(suggestion.folder)) {
      await chrome.storage.local.remove(suggestionKey);
      return; // User followed the rule, nothing to learn
    }

    console.log(
      `Learning opportunity: ${website} .${fileExtension} → ${folderName}`,
    );
  }

  // Check if user said "Don't ask again" for this rule
  const declinedData = await chrome.storage.sync.get("declinedSuggestions");
  const declinedKey = `${website}__${fileExtension}`;

  if (declinedData.declinedSuggestions?.[declinedKey]) {
    await chrome.storage.local.remove(suggestionKey);
    return;
  }

  // Check if rule already exists
  const rulesData = await chrome.storage.sync.get("siteRules");
  const existingRule = rulesData.siteRules?.[website]?.[fileExtension];

  if (existingRule) {
    // Rule exists but user saved somewhere different - ask if they want to update it
    // Only ask if the new folder is different from existing rule
    if (existingRule.toLowerCase() !== folderName.toLowerCase()) {
      await askToUpdateRule(
        website,
        fileExtension,
        folderName,
        download.id,
        declinedKey,
      );
    }
    await chrome.storage.local.remove(suggestionKey);
    return;
  }

  // New rule opportunity - ask user
  await askToCreateRule(
    website,
    fileExtension,
    folderName,
    download.id,
    declinedKey,
  );
}

// Ask user (via notification) whether to update an existing rule
async function askToUpdateRule(
  website,
  fileExtension,
  newFolder,
  downloadId,
  declinedKey,
) {
  const notificationId = `update_rule_${Date.now()}`;

  // Store data for the notification buttons
  await chrome.storage.local.set({
    [notificationId]: {
      website: website,
      extension: fileExtension,
      folder: newFolder,
      declinedKey: declinedKey,
      isUpdate: true, // Mark as update, not new rule
    },
  });

  // Show notification asking user
  chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: "assets/logo128x128.png",
    title: `Update rule for ${website}?`,
    message: `You saved .${fileExtension} to ${newFolder} instead of existing folder. Update the rule?`,
    buttons: [
      { title: "✓ Update Rule" },
      { title: "✕ Keep Old Rule" },
      { title: "Don't Ask Again" },
    ],
    requireInteraction: true,
  });

  // Clean up suggestion tracking
  await chrome.storage.local.remove(`suggested_${downloadId}`);
}

// Ask user (via notification) whether to create a new rule
async function askToCreateRule(
  website,
  fileExtension,
  folderName,
  downloadId,
  declinedKey,
) {
  const notificationId = `new_rule_${Date.now()}`;

  // Store data for the notification buttons
  await chrome.storage.local.set({
    [notificationId]: {
      website: website,
      extension: fileExtension,
      folder: folderName,
      declinedKey: declinedKey,
      isUpdate: false, // Mark as new rule
    },
  });

  // Show notification asking user
  chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: "assets/logo128x128.png",
    title: `Save ${website} .${fileExtension} to ${folderName}?`,
    message: `Click to choose a different folder`,
    buttons: [
      { title: "✓ Yes, Save Rule" },
      { title: "✕ No" },
      { title: "Don't Ask Again" },
    ],
    requireInteraction: true,
  });

  // Clean up suggestion tracking
  await chrome.storage.local.remove(`suggested_${downloadId}`);
}

// ============================================================================
// 5. NOTIFICATION HANDLERS (FIXED VERSION)
// ============================================================================

// Handle when user clicks buttons on notifications
chrome.notifications.onButtonClicked.addListener(
  async (notificationId, buttonIndex) => {
    // Only handle our learning notifications
    if (
      !notificationId.startsWith("update_rule_") &&
      !notificationId.startsWith("new_rule_")
    ) {
      return;
    }

    // Get stored data for this notification
    const data = await chrome.storage.local.get(notificationId);
    const ruleData = data[notificationId];

    if (!ruleData) return;

    // Get current rules
    const storage = await chrome.storage.sync.get("siteRules");
    let siteRules = storage.siteRules || {};

    if (buttonIndex === 0) {
      // User clicked "Yes" or "Update Rule"
      const website = ruleData.website.toLowerCase().trim();
      const extension = ruleData.extension.toLowerCase().trim();
      const folder = ruleData.folder.trim();

      // Make sure website exists in rules
      if (!siteRules[website]) {
        siteRules[website] = {};
      }

      // Add or update the rule
      siteRules[website][extension] = folder;

      // Save the updated rules
      await chrome.storage.sync.set({ siteRules: siteRules });

      // Tell options page to refresh
      try {
        await chrome.runtime.sendMessage({ action: "refreshData" });
      } catch (error) {
        // Options page might not be open, that's OK
      }

      // Show confirmation
      chrome.notifications.create({
        type: "basic",
        iconUrl: "assets/logo128x128.png",
        title: "Rule Saved ✓",
        message: `${website}: .${extension} files will now save to ${folder}/`,
      });

      console.log(`Rule saved: ${website} .${extension} → ${folder}`);
    } else if (buttonIndex === 2) {
      // User clicked "Don't Ask Again"
      const declinedData = await chrome.storage.sync.get("declinedSuggestions");
      const declined = declinedData.declinedSuggestions || {};
      declined[ruleData.declinedKey] = true;
      await chrome.storage.sync.set({ declinedSuggestions: declined });
    }

    // Clean up
    await chrome.storage.local.remove(notificationId);
    chrome.notifications.clear(notificationId);
  },
);

// Handle when user clicks the notification body (not a button)
chrome.notifications.onClicked.addListener(async (notificationId) => {
  // Only handle our learning notifications
  if (
    !notificationId.startsWith("update_rule_") &&
    !notificationId.startsWith("new_rule_")
  ) {
    return;
  }

  // Open options page to sorting rules tab
  await chrome.storage.local.set({ pendingTab: "sorting-rules" });

  const data = await chrome.storage.local.get(notificationId);
  const ruleData = data[notificationId];

  if (ruleData) {
    await chrome.storage.local.set({
      pendingLearning: {
        website: ruleData.website,
        extension: ruleData.extension,
        folder: ruleData.folder,
      },
    });
  }

  // Open or focus options page
  const url = chrome.runtime.getURL("options.html");
  const tabs = await chrome.tabs.query({ url });

  if (tabs.length > 0) {
    // Options page already open, switch to it
    chrome.tabs.update(tabs[0].id, { active: true });
    try {
      await chrome.runtime.sendMessage({ action: "refreshData" });
    } catch (error) {
      // Options page might not be listening
    }
  } else {
    // Open new options page
    chrome.tabs.create({ url });
  }

  // Clean up
  chrome.notifications.clear(notificationId);
  await chrome.storage.local.remove(notificationId);
});

// ============================================================================
// 6. HELPER FUNCTIONS
// ============================================================================

// Get the source URL of a download
async function getSourceUrl(downloadItem) {
  const url = downloadItem.finalUrl || downloadItem.url || "";

  // Handle special URLs (like blob: or data:)
  if (url.startsWith("blob:") || url.startsWith("data:")) {
    // Try to use referrer first
    if (downloadItem.referrer) {
      return downloadItem.referrer;
    }

    // Fallback: Get active tab URL
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });

      if (tabs && tabs[0]?.url) {
        console.log(`Using active tab URL: ${tabs[0].url}`);
        return tabs[0].url;
      }
    } catch (error) {
      console.log("Could not get active tab:", error);
    }
  }

  return url;
}

// Extract website from URL (e.g., "https://www.example.com/path" → "example.com")
function getWebsiteFromUrl(url) {
  if (!url) return "";

  // Skip data URLs
  if (url.startsWith("data:")) return "";

  try {
    // Add https:// if not present (for parsing)
    const fullUrl = url.includes("://") ? url : `https://${url}`;
    const urlObj = new URL(fullUrl);
    const hostname = urlObj.hostname.toLowerCase();

    // Remove "www." if present
    return hostname.replace(/^www\./, "");
  } catch (error) {
    // If URL parsing fails, return empty string
    return "";
  }
}

// Get file extension from filename (e.g., "file.jpg" → "jpg")
function getFileExtension(filename) {
  if (!filename) return "";
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

// Extract folder from full file path
function getFolderFromPath(filepath) {
  if (!filepath) return "";
  const normalized = filepath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");

  if (lastSlash === -1) return "";
  return normalized.slice(0, lastSlash + 1);
}

// Get just the folder name from a full path
function extractFolderName(folderPath) {
  if (!folderPath) return "";

  // Remove everything up to "IntelliSave/"
  const withoutIntelliSave = folderPath.replace(
    /^.*[\\\/]IntelliSave[\\\/]/,
    "",
  );

  // Remove Windows drive and Downloads folder paths
  const clean = withoutIntelliSave
    .replace(/^C:.*[\\\/]Downloads[\\\/]IntelliSave[\\\/]/, "")
    .replace(/^C:.*[\\\/]Downloads[\\\/]/, "")
    .replace(/[\\\/]$/, ""); // Remove trailing slash

  // If empty after cleaning, return "Root"
  return clean || "Root";
}
