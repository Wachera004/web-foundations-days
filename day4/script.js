// Select DOM elements
const noteText = document.getElementById("note-text");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");
const clearBtn = document.getElementById("clear-btn");
const themeToggle = document.getElementById("theme-toggle");

// Update character and word counters and apply warning/over classes
function updateCounts() {
  const text = noteText.value;
  const length = text.length;

  // Calculate word count
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;

  // Display counts
  charCount.textContent = `${length} / 200 characters`;
  wordCount.textContent = `${words} ${words === 1 ? "word" : "words"}`;

  // Manage counter color thresholds
  charCount.classList.remove("warning", "over");
  if (length > 200) {
    charCount.classList.add("over");
  } else if (length > 180) {
    charCount.classList.add("warning");
  }
}

// Initialize application state on page load
function initApp() {
  // Restore saved draft
  const savedDraft = localStorage.getItem("noteDraft");
  if (savedDraft !== null) {
    noteText.value = savedDraft;
  }

  // Restore saved theme choice
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "Light mode";
  } else {
    themeToggle.textContent = "Dark mode";
  }

  updateCounts();
}

// Event listener for typing in textarea
noteText.addEventListener("input", () => {
  updateCounts();
  localStorage.setItem("noteDraft", noteText.value);
});

// Clear button resets text, draft storage, and counters
clearBtn.addEventListener("click", () => {
  noteText.value = "";
  localStorage.removeItem("noteDraft");
  updateCounts();
});

// Pressing Escape inside the textarea clears it
noteText.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    noteText.value = "";
    localStorage.removeItem("noteDraft");
    updateCounts();
  }
});

// Theme toggle button functionality
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");

  if (document.body.classList.contains("dark")) {
    localStorage.setItem("theme", "dark");
    themeToggle.textContent = "Light mode";
  } else {
    localStorage.setItem("theme", "light");
    themeToggle.textContent = "Dark mode";
  }
});

// Run initialization when script loads
initApp();