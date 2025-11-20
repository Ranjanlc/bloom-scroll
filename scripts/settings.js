document.addEventListener("DOMContentLoaded", function () {
    const apiKeyInput = document.getElementById("api-key");
    const saveButton = document.getElementById("save-button");
    const successMessage = document.createElement("p");

    successMessage.innerText = "✅ API Key saved successfully!";
    successMessage.style.color = "#0077b5";
    successMessage.style.fontSize = "14px";
    successMessage.style.fontWeight = "500";
    successMessage.style.textAlign = "center";
    successMessage.style.marginTop = "10px";
    successMessage.style.display = "none";

    document.querySelector(".api-key-section").appendChild(successMessage);

    // Load API key from Chrome storage
    chrome.storage.sync.get("groqApiKey", function (data) {
        if (data.groqApiKey) {
            apiKeyInput.value = data.groqApiKey;
        }
    });

    // Save API key to Chrome storage
    saveButton.addEventListener("click", function () {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) return;

        chrome.storage.sync.set({ groqApiKey: apiKey }, function () {
            successMessage.style.display = "block";
            successMessage.style.opacity = "1";

            // Hide message after 3 seconds
            setTimeout(() => {
                successMessage.style.opacity = "0";
                setTimeout(() => {
                    successMessage.style.display = "none";
                }, 300);
            }, 3000);
        });
    });

    // Custom Prompt
    const customPromptInput = document.getElementById("custom-prompt");
    const savePromptButton = document.getElementById("save-prompt-button");
    const promptError = document.getElementById("prompt-error");
    const promptSuccess = document.getElementById("prompt-success");

    function countWords(str) {
        return (str.trim().match(/\S+/g) || []).length;
    }

    function updatePromptButtonState() {
        const words = countWords(customPromptInput.value);
        const isValid = words >= 5;
        savePromptButton.disabled = !isValid;
        promptError.style.display = isValid ? "none" : "block";
    }

    chrome.storage.sync.get("customPrompt", function (data) {
        if (data.customPrompt) {
            customPromptInput.value = data.customPrompt;
        }
        updatePromptButtonState();
    });

    customPromptInput.addEventListener("input", updatePromptButtonState);

    savePromptButton.addEventListener("click", function () {
        const prompt = customPromptInput.value.trim();
        if (countWords(prompt) < 5) return;
        chrome.storage.sync.set({ customPrompt: prompt }, function () {
            promptSuccess.style.display = "block";
            promptSuccess.style.opacity = "1";
            setTimeout(() => {
                promptSuccess.style.opacity = "0";
                setTimeout(() => {
                    promptSuccess.style.display = "none";
                }, 300);
            }, 3000);
        });
    });

    // Mute words functionality (moved from popup)
    let mutedWords = [];

    function loadMutedWords() {
        chrome.storage.sync.get(["mutedWords"], (data) => {
            mutedWords = data.mutedWords || [];
            updateMutedWordsDisplay();
        });
    }

    function saveMutedWords() {
        chrome.storage.sync.set({ mutedWords: mutedWords });
    }

    function updateMutedWordsDisplay() {
        const container = document.getElementById("muted-words-list");
        const emptyState = document.getElementById("empty-state");
        const clearAllBtn = document.getElementById("clear-all-btn");
        const muteCount = document.getElementById("mute-count");

        if (!container || !emptyState || !clearAllBtn || !muteCount) return;

        muteCount.textContent = `${mutedWords.length} word${mutedWords.length !== 1 ? 's' : ''}`;

        if (mutedWords.length === 0) {
            container.style.display = "none";
            emptyState.style.display = "block";
            clearAllBtn.style.display = "none";
        } else {
            container.style.display = "flex";
            emptyState.style.display = "none";
            clearAllBtn.style.display = "block";

            container.innerHTML = "";
            mutedWords.forEach((word, index) => {
                const wordTag = document.createElement("div");
                wordTag.className = "muted-word-tag";
                wordTag.innerHTML = `
                    <span>${word}</span>
                    <button class="remove-word-btn">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                `;

                const removeBtn = wordTag.querySelector(".remove-word-btn");
                removeBtn.addEventListener("click", () => removeMutedWord(index));

                container.appendChild(wordTag);
            });
        }
    }

    function addMutedWord() {
        const input = document.getElementById("mute-input");
        if (!input) return;
        const word = input.value.trim().toLowerCase();

        if (word && !mutedWords.includes(word) && mutedWords.length < 20) {
            mutedWords.push(word);
            saveMutedWords();
            updateMutedWordsDisplay();
            input.value = "";
            updateAddButtonState();
        }
    }

    function removeMutedWord(index) {
        mutedWords.splice(index, 1);
        saveMutedWords();
        updateMutedWordsDisplay();
        updateAddButtonState();
    }

    function clearAllMutedWords() {
        mutedWords = [];
        saveMutedWords();
        updateMutedWordsDisplay();
        updateAddButtonState();
    }

    function updateAddButtonState() {
        const input = document.getElementById("mute-input");
        const addBtn = document.getElementById("add-word-btn");
        if (!input || !addBtn) return;
        const word = input.value.trim().toLowerCase();

        const isValid = word && !mutedWords.includes(word) && mutedWords.length < 20;
        addBtn.disabled = !isValid;
    }

    const addWordBtn = document.getElementById("add-word-btn");
    const clearAllBtn = document.getElementById("clear-all-btn");
    const muteInput = document.getElementById("mute-input");

    if (addWordBtn) addWordBtn.addEventListener("click", addMutedWord);
    if (clearAllBtn) clearAllBtn.addEventListener("click", clearAllMutedWords);
    if (muteInput) {
        muteInput.addEventListener("input", updateAddButtonState);
        muteInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                addMutedWord();
            }
        });
    }

    loadMutedWords();
    updateAddButtonState();

    const misleadingToggle = document.getElementById("misleading-toggle");
    const harassmentToggle = document.getElementById("harassment-toggle");
    const superficialityToggle = document.getElementById("superficiality-toggle");
    const loweffortToggle = document.getElementById("loweffort-toggle");
    const intrusiveadsToggle = document.getElementById("intrusiveads-toggle");

    chrome.storage.sync.get([
        "filterMisleading",
        "filterHarassment",
        "filterSuperficiality",
        "filterLowEffort",
        "filterIntrusiveAds"
    ], function (data) {
        if (misleadingToggle) misleadingToggle.checked = data.filterMisleading ?? true;
        if (harassmentToggle) harassmentToggle.checked = data.filterHarassment ?? true;
        if (superficialityToggle) superficialityToggle.checked = data.filterSuperficiality ?? true;
        if (loweffortToggle) loweffortToggle.checked = data.filterLowEffort ?? true;
        if (intrusiveadsToggle) intrusiveadsToggle.checked = data.filterIntrusiveAds ?? true;
    });

    function saveFilters() {
        chrome.storage.sync.set({
            filterMisleading: misleadingToggle ? misleadingToggle.checked : true,
            filterHarassment: harassmentToggle ? harassmentToggle.checked : true,
            filterSuperficiality: superficialityToggle ? superficialityToggle.checked : true,
            filterLowEffort: loweffortToggle ? loweffortToggle.checked : true,
            filterIntrusiveAds: intrusiveadsToggle ? intrusiveadsToggle.checked : true
        });
    }

    if (misleadingToggle) misleadingToggle.addEventListener("change", saveFilters);
    if (harassmentToggle) harassmentToggle.addEventListener("change", saveFilters);
    if (superficialityToggle) superficialityToggle.addEventListener("change", saveFilters);
    if (loweffortToggle) loweffortToggle.addEventListener("change", saveFilters);
    if (intrusiveadsToggle) intrusiveadsToggle.addEventListener("change", saveFilters);
});
