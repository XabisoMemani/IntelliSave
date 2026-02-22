// IntelliSave Options Page
// Manages settings and rules

// Global variables to store settings
let siteRules = {}; // Website rules (was domainHints)
let fileCategories = {}; // File type categories
let currentEditingSite = null; // Which site is being edited
let activeCategory = null; // Which category is adding extensions

// Search filters
let activitySearch = "";
let rulesSearch = "";
let installTime = 0;

// ============================================================================
// 1. SETUP - Run when page loads
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupEventListeners();
  loadSettings();

  // Listen for updates from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "refreshData") {
      loadSettings();
    }
  });
});

// Set up sidebar navigation and page switching
function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");

  navItems.forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      const pageName = item.dataset.page;

      // Update active navigation item
      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");

      // Show the selected page
      document.querySelectorAll(".page").forEach((page) => {
        page.classList.remove("active");
      });
      document.getElementById(`page-${pageName}`).classList.add("active");

      // Load page content
      if (pageName === "activity-log") {
        showActivityLog();
      } else if (pageName === "sorting-rules") {
        showSortingRules();
      } else if (pageName === "preferences") {
        showPreferences();
      }
    });
  });
}

// Set up all event listeners
// Initialize event listeners for the page
function setupEventListeners() {
  setupSearchFilters();
  setupButtons();
  setupModals();
  setupTables();
}

// ============================================================================
// 2. LOAD AND SAVE SETTINGS
// ============================================================================

async function loadSettings() {
  try {
    // If running outside Chrome (e.g., VS Code preview), chrome.storage won't be available.
    // Fall back to built-in defaults so the UI still shows categories and options.
    if (
      typeof chrome === "undefined" ||
      !chrome.storage ||
      !chrome.storage.sync
    ) {
      siteRules = {};
      fileCategories = getDefaultCategories();
      installTime = 0;

      // Show defaults in the UI and set toggles to their default state
      updateToggle("extension-toggle", true);
      updateToggle("auto-routing-toggle", true);
      updateToggle("auto-learn-toggle", true);

      const activeNav = document.querySelector(".nav-item.active");
      const currentPage = activeNav ? activeNav.dataset.page : "activity-log";

      if (currentPage === "activity-log") showActivityLog();
      else if (currentPage === "sorting-rules") showSortingRules();
      else if (currentPage === "preferences") showPreferences();

      return;
    }

    // Check if we should switch to a specific tab (from notification click)
    const localData = await chrome.storage.local.get(["pendingTab"]);
    if (localData.pendingTab) {
      const tab = document.querySelector(
        `.nav-item[data-page="${localData.pendingTab}"]`,
      );
      if (tab) {
        tab.click();
        await chrome.storage.local.remove("pendingTab");
      }
    }

    // Get all settings from storage
    const data = await chrome.storage.sync.get([
      "siteRules", // Changed from domainHints
      "extensionEnabled",
      "learningEnabled",
      "installationTimestamp",
      "fileCategories",
    ]);

    // Store settings globally
    siteRules = data.siteRules || {};
    fileCategories = data.fileCategories || getDefaultCategories();
    installTime = data.installationTimestamp || 0;

    // Update toggle switches
    updateToggle("extension-toggle", data.extensionEnabled !== false);
    updateToggle("auto-routing-toggle", data.extensionEnabled !== false);
    updateToggle("auto-learn-toggle", data.learningEnabled !== false);

    // Show current page
    const activeNav = document.querySelector(".nav-item.active");
    const currentPage = activeNav ? activeNav.dataset.page : "activity-log";

    if (currentPage === "activity-log") showActivityLog();
    else if (currentPage === "sorting-rules") showSortingRules();
    else if (currentPage === "preferences") showPreferences();
  } catch (error) {
    console.error("Error loading settings:", error);
    showActivityLog(); // Show something even if error
  }
}

// Get default file categories
// Default file categories and their extensions
function getDefaultCategories() {
  return {
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
}

// Update a toggle switch
function updateToggle(id, isChecked) {
  const toggle = document.getElementById(id);
  if (toggle) toggle.checked = isChecked;
}

// ============================================================================
// 3. ACTIVITY LOG PAGE
// ============================================================================

// Render the activity log table (recent organized downloads)
function showActivityLog() {
  const listElement = document.getElementById("activity-list");
  const countElement = document.getElementById("total-count");

  if (!listElement) return;

  // Clear current list
  listElement.innerHTML = "";

  // Show loading or empty state during search
  const showEmptyState = (isSearching) => {
    listElement.innerHTML = `
      <tr>
        <td colspan="5" class="empty-message">
          <div class="empty-state-wrapper">
            <h3 class="empty-state-title">
              ${isSearching ? "No downloads found" : "No history yet"}
            </h3>
            <p class="empty-state-text">
              ${
                isSearching
                  ? `No downloads matching "${activitySearch}"`
                  : "Your sorted downloads will appear here"
              }
            </p>
          </div>
        </td>
      </tr>
    `;
    if (countElement) countElement.textContent = "0 downloads";
  };

  // For local development without Chrome API
  if (typeof chrome === "undefined" || !chrome.downloads) {
    showEmptyState(activitySearch.length > 0);
    return;
  }

  // Get download history
  chrome.downloads.search(
    { limit: 500, orderBy: ["-startTime"], state: "complete" },
    (downloads) => {
      if (chrome.runtime.lastError) {
        listElement.innerHTML = `
          <tr>
            <td colspan="5" class="empty-message">
              Error: ${chrome.runtime.lastError.message}
            </td>
          </tr>
        `;
        return;
      }

      try {
        // Filter to only IntelliSave downloads
        const intelliSaveDownloads = (downloads || []).filter((download) => {
          return download.filename.toLowerCase().includes("intellisave");
        });

        // Apply search filter
        const filteredDownloads = intelliSaveDownloads.filter((download) => {
          if (!activitySearch) return true;
          const fileName = download.filename.split(/[\\\/]/).pop() || "";
          return fileName.toLowerCase().includes(activitySearch);
        });

        if (filteredDownloads.length === 0) {
          showEmptyState(activitySearch.length > 0);
          return;
        }

        // Update count
        if (countElement) {
          const plural = filteredDownloads.length === 1 ? "" : "s";
          countElement.textContent = `${filteredDownloads.length} download${plural}`;
        }

        // Create table rows
        listElement.innerHTML = filteredDownloads
          .map((download) => {
            return createDownloadRow(download);
          })
          .join("");
      } catch (error) {
        console.error("Error showing activity log:", error);
        listElement.innerHTML = `
          <tr>
            <td colspan="5" class="empty-message">
              Error loading downloads
            </td>
          </tr>
        `;
      }
    },
  );
}

// Create HTML for a download row
function createDownloadRow(download) {
  const filename = download.filename.split(/[\\\/]/).pop() || "";
  const safeFilename = escapeHtml(filename);

  // Extract folder from path
  const folder = getDisplayFolder(download.filename);
  const safeFolder = escapeHtml(folder);

  // Format file size
  const size = formatFileSize(download.fileSize || download.totalBytes || 0);

  // Format date and time
  const time = parseTime(download.startTime);
  const dateText = formatDate(time);
  const timeText = formatTime(time);

  // Get icon for file type
  const extension = filename.toLowerCase().split(".").pop() || "";
  const icon = getFileIcon(extension, folder);

  return `
    <tr class="activity-row">
      <td class="cell-filename">
        <div class="filename-wrapper">
          <span class="filetype-icon" style="background-image: url('${icon}');"></span>
          <span class="filename-text" title="${safeFilename}">${safeFilename}</span>
        </div>
      </td>
      <td class="cell-size">${size}</td>
      <td class="cell-destination">${safeFolder}</td>
      <td class="cell-time">
        <div class="time-date">${dateText}</div>
        <div class="time-clock">${timeText}</div>
      </td>
      <td class="cell-actions">
        <button class="btn-remove" data-id="${download.id}" title="Remove from history">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </td>
    </tr>
  `;
}

// ============================================================================
// 4. SORTING RULES PAGE
// ============================================================================

// Render website-specific sorting rules in the rules table
function showSortingRules() {
  const listElement = document.getElementById("rules-list");
  if (!listElement) return;

  // Get sorted list of websites
  const websites = Object.keys(siteRules).sort();

  // Apply search filter
  const filteredWebsites = websites.filter((website) => {
    return website.toLowerCase().includes(rulesSearch);
  });

  if (filteredWebsites.length === 0) {
    const isSearching = rulesSearch.length > 0;
    listElement.innerHTML = `
      <tr>
        <td colspan="3" class="empty-message">
          <div class="empty-state-wrapper">
            <h3 class="empty-state-title">
              ${isSearching ? "No rules found" : "No custom rules yet"}
            </h3>
            <p class="empty-state-text">
              ${
                isSearching
                  ? `No rules matching "${rulesSearch}"`
                  : "Add your first website to start organizing!"
              }
            </p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Create table rows
  listElement.innerHTML = filteredWebsites
    .map((website) => {
      return createRuleRow(website);
    })
    .join("");
}

// Create HTML for a rule row
function createRuleRow(website) {
  const rules = siteRules[website];

  // Group extensions by folder
  const grouped = {};
  Object.entries(rules).forEach(([extension, folder]) => {
    if (!grouped[folder]) grouped[folder] = [];
    grouped[folder].push("." + extension);
  });

  // Create rule tags
  const ruleTags = Object.entries(grouped)
    .map(([folder, extensions]) => {
      return `<span class="rule-tag">${extensions.join(", ")} → ${folder}</span>`;
    })
    .join(" ");

  return `
    <tr class="activity-row">
      <td class="cell-domain">
        <div class="domain-wrapper">
          <img src="https://www.google.com/s2/favicons?domain=${website}&sz=32" 
               class="domain-favicon" alt="${website} icon" />
          <span class="domain-name">${website}</span>
        </div>
      </td>
      <td class="cell-rules">
        <div class="rules-wrapper">${ruleTags}</div>
      </td>
      <td class="cell-actions">
        <div class="actions-wrapper">
          <button class="btn-icon btn-edit-rule" data-website="${website}" title="Edit">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn-icon btn-danger btn-delete-rule" data-website="${website}" title="Delete">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `;
}

// Edit a website's rules
// Open edit flow for an existing website rule
// Open edit flow for an existing website rule
function editWebsite(website) {
  currentEditingSite = website;
  const rules = siteRules[website];
  const selectedExtensions = Object.keys(rules);
  openSiteModal(website, selectedExtensions);
}

// Delete a website's rules
async function deleteWebsite(website) {
  if (confirm(`Remove all rules for ${website}?`)) {
    delete siteRules[website];
    await chrome.storage.sync.set({ siteRules: siteRules });
    showSortingRules();
  }
}

// ============================================================================
// 5. PREFERENCES PAGE
// ============================================================================

function showPreferences() {
  const listElement = document.getElementById("categories-list");
  if (!listElement) return;

  listElement.innerHTML = Object.entries(fileCategories)
    .map(([name, extensions]) => {
      return createCategoryItem(name, extensions);
    })
    .join("");

  // Add event listeners for category items
  setupCategoryListeners();
}

// Create HTML for a category item
function createCategoryItem(name, extensions) {
  const icon = getFileIcon(name.toLowerCase(), name);
  const extensionTags = extensions
    .map((ext) => {
      return `
      <span class="category-ext-tag">
        .${ext}
        <button class="btn-remove-ext" data-category="${name}" data-ext="${ext}">
          &times;
        </button>
      </span>
    `;
    })
    .join("");

  return `
    <div class="category-item">
      <div class="category-header">
        <img src="${icon}" class="category-icon" alt="${name} icon" />
        <span class="category-name">${name}</span>
        <button class="btn-add-ext" data-category="${name}" title="Add extension">
          +
        </button>
      </div>
      <div class="category-exts-wrapper">
        ${extensionTags}
      </div>
    </div>
  `;
}

// ============================================================================
// 6. MODAL WINDOWS
// ============================================================================

// Open modal to add/edit website rules
function openSiteModal(website = "", selectedExtensions = []) {
  const modal = document.getElementById("site-modal-overlay");
  const title = document.getElementById("site-modal-title");
  const websiteInput = document.getElementById("site-domain-input");
  const checkboxes = document.getElementById("file-type-checkboxes");

  // Set modal title
  title.textContent = website ? "Edit Website" : "Add New Website";
  websiteInput.value = website;

  // Get existing rules for this website
  const existingRules = website ? siteRules[website] : {};

  // Create category checkboxes
  checkboxes.innerHTML = Object.entries(fileCategories)
    .map(([name, extensions]) => {
      // Check if any extension in this category is selected
      const isChecked = selectedExtensions.some((ext) =>
        extensions.includes(ext),
      );

      // Find current folder for this category
      let currentFolder = name;
      if (website) {
        const matchedExt = selectedExtensions.find((ext) =>
          extensions.includes(ext),
        );
        if (matchedExt) currentFolder = existingRules[matchedExt];
      }

      return `
      <div class="modal-rule-row">
        <label class="file-type-option">
          <input type="checkbox" class="category-checkbox" 
                 value="${name}" data-exts="${extensions.join(",")}" 
                 ${isChecked ? "checked" : ""}>
          <img src="${getFileIcon(name.toLowerCase(), name)}" class="category-icon" alt="" />
          <div class="category-meta">
            <span class="category-name">${name}</span>
            <span class="file-type-exts">
              ${extensions.map((e) => "." + e).join(", ")}
            </span>
          </div>
        </label>
        <div class="folder-override">
          <span class="arrow">→</span>
          <input type="text" class="override-input" value="${currentFolder}" 
                 placeholder="Folder name...">
        </div>
      </div>
    `;
    })
    .join("");

  // Show modal
  modal.style.display = "flex";
}

// Close website modal
function closeSiteModal() {
  document.getElementById("site-modal-overlay").style.display = "none";
  currentEditingSite = null;
}

// ============================================================================
// Extension modal helpers
// ============================================================================

// Open 'Add Extension' modal for a category and focus the input
function openExtensionModal(category) {
  activeCategory = category;
  const overlay = document.getElementById("ext-modal-overlay");
  const label = document.getElementById("ext-modal-label");
  const input = document.getElementById("ext-modal-input");

  if (!overlay || !input) return;
  if (label) label.textContent = `Extension for ${category}`;
  input.value = "";
  overlay.style.display = "flex";
  // small timeout to ensure element is visible then focus
  setTimeout(() => input.focus(), 50);
}

// Close the 'Add Extension' modal and reset state
function closeExtensionModal() {
  const overlay = document.getElementById("ext-modal-overlay");
  if (overlay) overlay.style.display = "none";
  activeCategory = null;
}

// Validate input and save new extension(s) for the active category
async function saveExtensionFromModal() {
  const input = document.getElementById("ext-modal-input");
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) {
    alert("Please enter an extension (e.g. 'js' or 'php')");
    return;
  }

  const parts = raw
    .split(/[\s,]+/)
    .map((s) => s.replace(/^\.+/, "").toLowerCase().trim())
    .filter(Boolean);

  if (parts.length === 0) {
    alert("No valid extensions found");
    return;
  }

  if (!activeCategory) {
    alert("No category selected");
    return;
  }

  fileCategories[activeCategory] = fileCategories[activeCategory] || [];
  let changed = false;

  parts.forEach((ext) => {
    // Simple validation: alphanumeric, 1-8 chars
    if (!/^[a-z0-9]{1,8}$/.test(ext)) return;
    if (!fileCategories[activeCategory].includes(ext)) {
      fileCategories[activeCategory].push(ext);
      changed = true;
    }
  });

  if (changed) {
    try {
      await chrome.storage.sync.set({ fileCategories: fileCategories });
    } catch (err) {
      console.error("Failed to save extensions:", err);
    }
    showPreferences();
  }

  closeExtensionModal();
}

// Save website rules from modal
// Save rules created/edited in the website modal
async function saveSiteRules() {
  const websiteInput = document.getElementById("site-domain-input");
  const website = websiteInput.value.trim().toLowerCase();

  if (!website) {
    alert("Please enter a website");
    return;
  }

  const newRules = {};

  // Process category checkboxes
  const checkboxes = document.querySelectorAll(".category-checkbox:checked");
  checkboxes.forEach((checkbox) => {
    const folderInput = checkbox
      .closest(".modal-rule-row")
      .querySelector(".override-input");
    const folder = folderInput.value.trim() || checkbox.value;
    const extensions = checkbox.dataset.exts.split(",");

    extensions.forEach((extension) => {
      newRules[extension] = folder;
    });
  });

  // Process custom extensions (if you add this feature later)
  // const customInput = document.getElementById("custom-exts-input");
  // if (customInput && customInput.value.trim()) {
  //   // Handle custom extensions
  // }

  if (Object.keys(newRules).length === 0) {
    alert("Please select at least one file type");
    return;
  }

  // If editing different website, remove old one
  if (currentEditingSite && currentEditingSite !== website) {
    delete siteRules[currentEditingSite];
  }

  // Save new rules
  siteRules[website] = newRules;
  await chrome.storage.sync.set({ siteRules: siteRules });

  closeSiteModal();
  showSortingRules();
}

// ============================================================================
// 7. HELPER FUNCTIONS
// ============================================================================

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

// Format file size (bytes to KB, MB, etc.)
function formatFileSize(bytes) {
  if (!bytes || bytes < 0) return "—";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);

  // Show 0 decimal places for large numbers, 1 for small
  const decimals = value >= 10 || exponent === 0 ? 0 : 1;

  return `${value.toFixed(decimals)} ${units[exponent]}`;
}

// Parse time from download API
function parseTime(timeString) {
  if (!timeString) return null;
  const time =
    typeof timeString === "number" ? timeString : Date.parse(timeString);
  return Number.isFinite(time) ? new Date(time) : null;
}

// Format date as "Jan 1, 2023"
function formatDate(date) {
  if (!date) return "unknown";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Format time as "14:30"
function formatTime(date) {
  if (!date) return "--:--";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Get icon path for file type
function getFileIcon(extension, folder) {
  const folderLower = (folder || "").toLowerCase();
  const extLower = (extension || "").toLowerCase();

  // Map extensions to icons
  const iconMap = {
    // Image files
    jpg: "photo",
    jpeg: "photo",
    png: "photo",
    webp: "photo",
    bmp: "photo",
    tiff: "photo",

    // GIFs
    gif: "gif",

    // Vector files
    svg: "vector",
    ai: "vector",
    eps: "vector",
    ico: "vector",
    icns: "vector",

    // Graphics
    psd: "graphic",
    sketch: "graphic",
    xd: "graphic",
    fig: "graphic",

    // Documents
    pdf: "pdf",
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
    xml: "code",
    java: "code",
    cpp: "code",
    cs: "code",
    php: "code",

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
  if (folderLower.includes("gif")) return "assets/file-icons/gif.svg";
  if (folderLower.includes("vector")) return "assets/file-icons/vector.svg";
  if (folderLower.includes("graphic") || folderLower.includes("design"))
    return "assets/file-icons/graphic.svg";
  if (folderLower.includes("doc")) return "assets/file-icons/document.svg";
  if (folderLower.includes("pdf")) return "assets/file-icons/pdf.svg";
  if (folderLower.includes("archive") || folderLower.includes("zip"))
    return "assets/file-icons/archive.svg";
  if (folderLower.includes("audio") || folderLower.includes("music"))
    return "assets/file-icons/audio.svg";
  if (folderLower.includes("video")) return "assets/file-icons/video.svg";
  if (folderLower.includes("code")) return "assets/file-icons/code.svg";
  if (folderLower.includes("font")) return "assets/file-icons/font.svg";
  if (folderLower.includes("app") || folderLower.includes("software"))
    return "assets/file-icons/app.svg";

  // Default
  return "assets/file-icons/unknown.svg";
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// 8. EVENT LISTENER SETUP FUNCTIONS
// ============================================================================

function setupSearchFilters() {
  // Activity log search
  const activitySearchInput = document.getElementById("filter-search");
  if (activitySearchInput) {
    let searchTimer;
    activitySearchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        activitySearch = activitySearchInput.value.trim().toLowerCase();
        showActivityLog();
      }, 300);
    });
  }

  // Rules search
  const rulesSearchInput = document.getElementById("search-rules");
  if (rulesSearchInput) {
    let searchTimer;
    rulesSearchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        rulesSearch = rulesSearchInput.value.trim().toLowerCase();
        showSortingRules();
      }, 300);
    });
  }
}

function setupButtons() {
  // Add site button
  const addSiteBtn = document.getElementById("add-site-btn");
  if (addSiteBtn) {
    addSiteBtn.addEventListener("click", () => openSiteModal());
  }

  // Toggle switches
  const routingToggle = document.getElementById("auto-routing-toggle");
  if (routingToggle) {
    routingToggle.addEventListener("change", (event) => {
      chrome.storage.sync.set({ extensionEnabled: event.target.checked });
    });
  }

  const learnToggle = document.getElementById("auto-learn-toggle");
  if (learnToggle) {
    learnToggle.addEventListener("change", (event) => {
      chrome.storage.sync.set({ learningEnabled: event.target.checked });
    });
  }

  // Sync extension toggle across pages: listen for storage changes and update UI
  if (chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;

      if (changes.extensionEnabled) {
        const newVal = !!changes.extensionEnabled.newValue;
        updateToggle("extension-toggle", newVal);
        updateToggle("auto-routing-toggle", newVal);
      }
    });
  }
}

function setupModals() {
  // Website modal
  const siteModal = {
    overlay: document.getElementById("site-modal-overlay"),
    close: document.getElementById("site-modal-close"),
    cancel: document.getElementById("site-modal-cancel"),
    save: document.getElementById("site-modal-save"),
  };

  if (siteModal.close)
    siteModal.close.addEventListener("click", closeSiteModal);
  if (siteModal.cancel)
    siteModal.cancel.addEventListener("click", closeSiteModal);
  if (siteModal.save) siteModal.save.addEventListener("click", saveSiteRules);

  if (siteModal.overlay) {
    siteModal.overlay.addEventListener("click", (event) => {
      if (event.target.id === "site-modal-overlay") closeSiteModal();
    });
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSiteModal();
      closeExtensionModal();
    } else if (
      event.key === "Enter" &&
      siteModal.overlay.style.display === "flex"
    ) {
      saveSiteRules();
    }
  });

  // Extension modal wiring
  const extModal = {
    overlay: document.getElementById("ext-modal-overlay"),
    close: document.getElementById("ext-modal-close"),
    cancel: document.getElementById("ext-modal-cancel"),
    save: document.getElementById("ext-modal-save"),
    label: document.getElementById("ext-modal-label"),
    input: document.getElementById("ext-modal-input"),
  };

  if (extModal.close)
    extModal.close.addEventListener("click", closeExtensionModal);
  if (extModal.cancel)
    extModal.cancel.addEventListener("click", closeExtensionModal);
  if (extModal.save)
    extModal.save.addEventListener("click", saveExtensionFromModal);

  if (extModal.overlay) {
    extModal.overlay.addEventListener("click", (event) => {
      if (event.target.id === "ext-modal-overlay") closeExtensionModal();
    });
  }

  // Keyboard handler for extension modal (Enter)
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      extModal.overlay &&
      extModal.overlay.style.display === "flex"
    ) {
      saveExtensionFromModal();
    }
  });
}

function setupTables() {
  // Activity log - remove items
  const activityList = document.getElementById("activity-list");
  if (activityList) {
    activityList.addEventListener("click", async (event) => {
      const removeButton = event.target.closest(".btn-remove");
      if (!removeButton) return;

      const downloadId = removeButton.dataset.id;
      if (!downloadId) return;

      try {
        await chrome.downloads.erase({ id: parseInt(downloadId) });
        showActivityLog();
      } catch (error) {
        console.error("Error removing download:", error);
      }
    });
  }

  // Rules table - edit/delete
  const rulesList = document.getElementById("rules-list");
  if (rulesList) {
    rulesList.addEventListener("click", (event) => {
      const editButton = event.target.closest(".btn-edit-rule");
      const deleteButton = event.target.closest(".btn-delete-rule");

      if (editButton) {
        const website = editButton.dataset.website;
        if (website) editWebsite(website);
      } else if (deleteButton) {
        const website = deleteButton.dataset.website;
        if (website) deleteWebsite(website);
      }
    });
  }
}

function setupCategoryListeners() {
  // Remove extension buttons
  document.querySelectorAll(".btn-remove-ext").forEach((button) => {
    button.addEventListener("click", async () => {
      const { category, ext } = button.dataset;

      // Remove extension from category
      fileCategories[category] = fileCategories[category].filter(
        (e) => e !== ext,
      );

      // Save and refresh
      await chrome.storage.sync.set({ fileCategories: fileCategories });
      showPreferences();
    });
  });

  // Add extension buttons
  document.querySelectorAll(".btn-add-ext").forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.category;
      openExtensionModal(category);
    });
  });
}
