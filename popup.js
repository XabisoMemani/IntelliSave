// IntelliSave Popup - To just show quick download history

// ============================================================================
// 1. INITIALIZATION
// ============================================================================

// Run when popup opens
document.addEventListener("DOMContentLoaded", () => {
  initializePopup();
});

// Initialize popup: load settings and recent downloads
async function initializePopup() {
  try {
    // Load extension state
    const settings = await chrome.storage.sync.get(["extensionEnabled"]);

    // Set toggle switch
    const toggle = document.getElementById("popup-toggle");
    if (settings.extensionEnabled !== undefined) {
      toggle.checked = settings.extensionEnabled;
    }

    // Load recent downloads
    showRecentDownloads();
  } catch (error) {
    // Running outside extension (like in browser preview)
    console.log("Running in preview mode");
  }

  setupPopupListeners();
}

// ============================================================================
// 2. EVENT LISTENERS
// ============================================================================

// Wire popup event listeners (toggle, settings, view all)
function setupPopupListeners() {
  // Toggle switch - turn extension on/off
  const toggle = document.getElementById("popup-toggle");
  toggle.addEventListener("change", async (event) => {
    try {
      await chrome.storage.sync.set({ extensionEnabled: event.target.checked });
    } catch (error) {
      console.log("Could not save setting");
    }
  });

  // Settings button - open options page
  const settingsButton = document.getElementById("open-settings");
  settingsButton.addEventListener("click", () => {
    try {
      chrome.runtime.openOptionsPage();
    } catch (error) {
      // Fallback for testing
      window.open("options.html", "_blank");
    }
  });

  // View all button - open full activity log
  const viewAllButton = document.getElementById("view-all");
  viewAllButton.addEventListener("click", () => {
    try {
      const url = chrome.runtime.getURL("options.html#activity-log");
      chrome.tabs.create({ url });
    } catch (error) {
      // Fallback for testing
      window.open("options.html#activity-log", "_blank");
    }
  });

  // Keep popup toggle in sync if the setting changes elsewhere (options page)
  if (chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      if (changes.extensionEnabled) {
        const newValue = !!changes.extensionEnabled.newValue;
        const toggleEl = document.getElementById("popup-toggle");
        if (toggleEl && toggleEl.checked !== newValue)
          toggleEl.checked = newValue;
      }
    });
  }
}

// ============================================================================
// 3. SHOW RECENT DOWNLOADS
// ============================================================================

// Show recent downloads in popup
function showRecentDownloads() {
  const downloadList = document.getElementById("recent-list");
  const emptyMessage = document.getElementById("recent-empty");

  if (!downloadList) return;

  // For testing without Chrome API
  if (typeof chrome === "undefined" || !chrome.downloads) {
    downloadList.innerHTML = "";
    if (emptyMessage) emptyMessage.style.display = "flex";
    return;
  }

  // Get recent downloads
  chrome.downloads.search(
    { limit: 50, orderBy: ["-startTime"], state: "complete" },
    (downloads) => {
      // Filter to only IntelliSave downloads
      const intelliSaveDownloads = downloads
        .filter((download) => {
          return download.filename.toLowerCase().includes("intellisave");
        })
        .slice(0, 4); // Show only 4 most recent

      if (intelliSaveDownloads.length === 0) {
        downloadList.innerHTML = "";
        if (emptyMessage) emptyMessage.style.display = "flex";
        return;
      }

      // Hide empty message
      if (emptyMessage) emptyMessage.style.display = "none";

      // Create download list
      downloadList.innerHTML = intelliSaveDownloads
        .map((download) => {
          return createDownloadItem(download);
        })
        .join("");
    },
  );
}

// Create HTML for a download item in popup
function createDownloadItem(download) {
  const filename = download.filename.split(/[\\\/]/).pop() || "";
  const safeFilename = escapeHtml(filename);

  // Extract folder
  const folder = getDisplayFolder(download.filename);
  const safeFolder = escapeHtml(folder);

  // Time ago (e.g., "2h ago")
  const timeAgo = getTimeAgo(download.startTime);

  // Get icon
  const extension = filename.toLowerCase().split(".").pop() || "";
  const icon = getFileIcon(extension, folder);

  return `
    <div class="recent-item">
      <div class="file-icon" style="background-image: url('${icon}');"></div>
      <div class="file-details">
        <div class="file-name" title="${safeFilename}">${safeFilename}</div>
        <div class="file-destination">${safeFolder}</div>
      </div>
      <div class="file-time">${timeAgo}</div>
    </div>
  `;
}

// ============================================================================
// 4. HELPER FUNCTIONS
// ============================================================================

// Get "time ago" string (e.g., "2h ago")
function getTimeAgo(timestamp) {
  if (!timestamp) return "unknown";

  const time = parseTime(timestamp);
  if (!time) return "unknown";

  const now = new Date();
  const diffMs = now - time;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return time.toLocaleDateString();
}

// Parse time from download API
function parseTime(timeString) {
  if (!timeString) return null;
  const time =
    typeof timeString === "number" ? timeString : Date.parse(timeString);
  return Number.isFinite(time) ? new Date(time) : null;
}

// Extract folder name for display
function getDisplayFolder(filepath) {
  const normalized = filepath.replace(/\\/g, "/");
  const intelliSaveIndex = normalized.toLowerCase().indexOf("intellisave/");

  if (intelliSaveIndex === -1) return "Root";

  const afterIntelliSave = normalized.substring(
    intelliSaveIndex + "intellisave/".length,
  );
  const folderParts = afterIntelliSave.split("/");
  folderParts.pop(); // Remove filename

  return folderParts.join("/") || "Root";
}

// Get icon for file type
function getFileIcon(extension, folder) {
  const folderLower = (folder || "").toLowerCase();
  const extLower = (extension || "").toLowerCase();

  // Simple icon mapping
  const iconMap = {
    // Images
    jpg: "photo",
    jpeg: "photo",
    png: "photo",
    gif: "photo",
    webp: "photo",
    bmp: "photo",
    tiff: "photo",

    // Documents
    pdf: "document",
    doc: "document",
    docx: "document",
    txt: "document",
    rtf: "document",
    odt: "document",

    // Archives
    zip: "archive",
    rar: "archive",
    "7z": "archive",
    tar: "archive",
    gz: "archive",

    // Audio
    mp3: "audio",
    wav: "audio",
    flac: "audio",
    aac: "audio",
    ogg: "audio",
    m4a: "audio",

    // Video
    mp4: "video",
    mov: "video",
    webm: "video",
    mkv: "video",
    avi: "video",
    flv: "video",

    // Code
    js: "code",
    py: "code",
    html: "code",
    css: "code",
    json: "code",

    // Fonts
    ttf: "font",
    otf: "font",
    woff: "font",
    woff2: "font",
    eot: "font",

    // Apps
    exe: "app",
    msi: "app",
    dmg: "app",
    pkg: "app",
    deb: "app",
    rpm: "app",
  };

  // Try extension first
  if (iconMap[extLower]) {
    return `assets/file-icons/${iconMap[extLower]}.svg`;
  }

  // Try folder name
  if (folderLower.includes("photo") || folderLower.includes("image"))
    return "assets/file-icons/photo.svg";
  if (folderLower.includes("doc")) return "assets/file-icons/document.svg";
  if (folderLower.includes("archive") || folderLower.includes("zip"))
    return "assets/file-icons/archive.svg";
  if (folderLower.includes("audio") || folderLower.includes("music"))
    return "assets/file-icons/audio.svg";
  if (folderLower.includes("video")) return "assets/file-icons/video.svg";
  if (folderLower.includes("code")) return "assets/file-icons/code.svg";
  if (folderLower.includes("font")) return "assets/file-icons/font.svg";

  // Default
  return "assets/file-icons/unknown.svg";
}

// Escape HTML for safety
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
