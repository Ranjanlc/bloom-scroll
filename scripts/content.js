function getApiKeyIfEnabled() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["groqApiKey", "isEnabled"], (data) => {
      if (data.isEnabled && data.groqApiKey) {
        resolve(data.groqApiKey);
      } else {
        console.warn("GROQ API key not found or extension is disabled.");
        resolve(null);
      }
    });
  });
}

function getMutedWords() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["mutedWords"], (data) => {
      resolve(data.mutedWords || []);
    });
  });
}

function getCustomPrompt() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["customPrompt"], (data) => {
      resolve(data.customPrompt || null);
    });
  });
}

function containsMutedWords(text, mutedWords) {
  if (!mutedWords || mutedWords.length === 0) return false;

  const lowerText = text.toLowerCase();
  return mutedWords.some((word) => lowerText.includes(word.toLowerCase()));
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const heartbeatIntervals = {};
let processedCount = 0;
function startHeartbeat(label) {
  if (heartbeatIntervals[label]) return;
  heartbeatIntervals[label] = setInterval(() => {
    console.warn("[Bloom Scroll] Heartbeat", {
      label,
      ts: Date.now(),
      processedCount,
    });
  }, 10000);
}

async function initExtension() {
  const apiKey = await getApiKeyIfEnabled();
  if (!apiKey) {
    console.warn(
      "GROQ API key not found. Please set your API key in the extension settings."
    );
    return; // Stop execution if no API key
  }

  startHeartbeat("init");
  cringeGuardExistingPosts();
  observeNewPosts();
}

function estimateTimeSavedInSeconds(postText) {
  const wordCount = postText.split(/\s+/).length;

  if (wordCount <= 20) return 5; // Short posts (~5 sec saved)
  if (wordCount <= 50) return 10; // Medium posts (~10 sec saved)
  return 20; // Long posts (~20 sec saved)
}

function updateCringeStats(postText) {
  chrome.storage.sync.get(["cringeCount", "timeSavedInMinutes"], (data) => {
    const newCount = (data.cringeCount || 0) + 1;
    const estimatedTimeSavedInSeconds = estimateTimeSavedInSeconds(postText);

    const newTimeSavedInMinutes =
      parseFloat(data.timeSavedInMinutes || 0) +
      estimatedTimeSavedInSeconds / 60; // Convert to minutes

    chrome.storage.sync.set({
      cringeCount: newCount,
      timeSavedInMinutes: newTimeSavedInMinutes,
    });
  });
}

function cringeGuardThisPost(post, filterMode, reason) {
  // 1. Find the container.
  const isLinkedIn = window.location.hostname.includes("linkedin.com");
  const contentContainer = isLinkedIn
    ? (post.closest('div[data-view-name="feed-full-update"]') || post.closest('.feed-shared-update-v2') || post)
    : (post.closest('article[data-testid="tweet"]') || post);

  // 2. Find the outer list item wrapper to handle removal cleanly
  const outerContainer = isLinkedIn
    ? (contentContainer.closest('div[role="listitem"]') || contentContainer)
    : contentContainer;

  if (outerContainer) {
    // --- REMOVE MODE ---
    if (filterMode === "remove") {
      outerContainer.style.display = "none";
      outerContainer.style.setProperty("display", "none", "important");
      console.log("[Bloom Scroll] Post removed");
      return;
    }

    // --- BLUR MODE ---
    if (contentContainer.dataset.cringeGuarded === "true") return;
    contentContainer.dataset.cringeGuarded = "true";

    const wrapper = document.createElement("div");
    while (contentContainer.firstChild) {
      wrapper.appendChild(contentContainer.firstChild);
    }

    wrapper.style.filter = "blur(12px)";
    wrapper.style.webkitFilter = "blur(12px)";
    wrapper.style.transition = "filter 0.3s ease, opacity 0.3s ease";
    wrapper.style.opacity = "0.4";
    wrapper.style.width = "100%";
    wrapper.style.height = "auto";
    wrapper.style.pointerEvents = "none";

    contentContainer.style.position = "relative";
    contentContainer.style.display = "block";
    contentContainer.style.minHeight = "150px";
    contentContainer.style.overflow = "hidden";

    const button = document.createElement("button");
    button.innerText = "Click to View";
    button.style.position = "absolute";
    button.style.top = "50%";
    button.style.left = "50%";
    button.style.transform = "translate(-50%, -50%)";
    button.style.zIndex = "100";
    button.style.backgroundColor = "#0a66c2";
    button.style.color = "white";
    button.style.border = "none";
    button.style.padding = "10px 20px";
    button.style.fontSize = "16px";
    button.style.fontWeight = "600";
    button.style.borderRadius = "24px";
    button.style.cursor = "pointer";
    button.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
    button.style.transition = "transform 0.1s ease, background-color 0.2s";

    button.onmouseover = () => {
      button.style.backgroundColor = "#004182";
      button.style.transform = "translate(-50%, -50%) scale(1.05)";
    };
    button.onmouseout = () => {
      button.style.backgroundColor = "#0a66c2";
      button.style.transform = "translate(-50%, -50%) scale(1)";
    };

    let reasonBadge;
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      wrapper.style.filter = "none";
      wrapper.style.webkitFilter = "none";
      wrapper.style.opacity = "1";
      wrapper.style.pointerEvents = "auto";
      button.remove();
      if (reasonBadge) reasonBadge.remove();
    });

    if (reason) {
      reasonBadge = document.createElement("div");
      reasonBadge.innerText = `Reason: ${reason}`;
      reasonBadge.style.position = "absolute";
      reasonBadge.style.top = "calc(50% - 60px)";
      reasonBadge.style.left = "50%";
      reasonBadge.style.transform = "translate(-50%, -50%)";
      reasonBadge.style.zIndex = "99";
      reasonBadge.style.backgroundColor = "rgba(10, 102, 194, 0.9)";
      reasonBadge.style.color = "white";
      reasonBadge.style.padding = "8px 12px";
      reasonBadge.style.borderRadius = "12px";
      reasonBadge.style.fontSize = "13px";
      reasonBadge.style.fontWeight = "600";
      reasonBadge.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
      contentContainer.appendChild(reasonBadge);
    }

    contentContainer.appendChild(wrapper);
    contentContainer.appendChild(button);
  }
}

async function checkForCringe({
  actorName,
  actorDescription,
  actorSubDescription,
  postContent,
}) {
  if (
    actorDescription.toLowerCase().includes("promoted") ||
    actorSubDescription.toLowerCase().includes("promoted")
  ) {
    return { isCringe: true, reason: "Promoted content" };
  }

  const mutedWords = await getMutedWords();
  if (
    containsMutedWords(actorName, mutedWords) ||
    containsMutedWords(actorDescription, mutedWords) ||
    containsMutedWords(actorSubDescription, mutedWords) ||
    containsMutedWords(postContent, mutedWords)
  ) {
    return { isCringe: true, reason: "Contains muted words" };
  }

  const apiKey = await getApiKeyIfEnabled();
  if (!apiKey) return;

  const filters = await new Promise((resolve) => {
    chrome.storage.sync.get(
      [
        "filterMisleading",
        "filterHarassment",
        "filterSuperficiality",
        "filterLowEffort",
        "filterIntrusiveAds",
      ],
      (data) => {
        resolve({
          filterMisleading: data.filterMisleading ?? true,
          filterHarassment: data.filterHarassment ?? true,
          filterSuperficiality: data.filterSuperficiality ?? true,
          filterLowEffort: data.filterLowEffort ?? true,
          filterIntrusiveAds: data.filterIntrusiveAds ?? true,
        });
      }
    );
  });

  const criteria = [];
  if (filters.filterMisleading)
    criteria.push("Contains misleading information, scams, or hoaxes");
  if (filters.filterHarassment)
    criteria.push("Contains trolling, harassment, or personal attacks");
  if (filters.filterSuperficiality)
    criteria.push("Promotes an obviously inauthentic or misleading persona");
  if (filters.filterLowEffort)
    criteria.push("Uses low-effort engagement bait like 'Tag 3 people'");
  if (filters.filterIntrusiveAds)
    criteria.push("Irrelevant brand promotional content or disruptive ads");

  const SYSTEM_PROMPT_PREFIX = "You are a content analyzer. Determine if the post meets any criteria:";
  const promptFromFilters = criteria.length > 0
    ? `${SYSTEM_PROMPT_PREFIX}\n- ${criteria.join("\n- ")}\nIf any met, respond with POST_IS_CRINGE, else POST_IS_NOT_CRINGE.`
    : "Always respond with POST_IS_NOT_CRINGE.";

  const customPrompt = await getCustomPrompt();
  const customPromptFull = SYSTEM_PROMPT_PREFIX + "\n" + customPrompt + "\n If any met, respond with POST_IS_CRINGE, else POST_IS_NOT_CRINGE.";
  const systemMessage = customPrompt && customPrompt.trim().split(/\s+/).length >= 5 ? customPromptFull : promptFromFilters;

  try {
    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "CHECK_CRINGE",
          data: { apiKey, systemMessage, postContent },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Runtime error:", chrome.runtime.lastError);
            resolve({ success: false });
          } else {
            resolve(response);
          }
        }
      );
    });

    if (!result || !result.success) return { isCringe: false, reason: null };

    const data = result.data;
    if (data.error) return { isCringe: false, reason: null };

    const raw = (data.choices?.[0]?.message?.content || "").trim();
    if (raw.toLowerCase().includes("post_is_cringe")) {
      const reason = raw.split(/post_is_cringe\s*:?/i)[1]?.trim() || "Cringe content";
      return { isCringe: true, reason };
    }
    return { isCringe: false, reason: null };
  } catch (error) {
    console.error("Error checking post:", error);
    return { isCringe: false, reason: null };
  }
}

const alreadyProcessedPosts = new Set();
async function processPost(post) {
  startHeartbeat("process");
  const isLinkedIn = window.location.hostname.includes("linkedin.com");

  const commentaryElement = isLinkedIn
    ? post.querySelector('[data-view-name="feed-commentary"], [data-testid="expandable-text-box"], .update-components-text, .feed-shared-update-v2__description')
    : post.querySelector('[data-testid="tweetText"]');

  if (!commentaryElement) return;
  if (alreadyProcessedPosts.has(commentaryElement)) return;
  alreadyProcessedPosts.add(commentaryElement);
  processedCount++;

  let actorName = "Unknown", actorDescription = "No description", actorSubDescription = "No sub-description", postImage = "No Image";

  if (isLinkedIn) {
    const nameAnchor = post.querySelector('a[data-view-name="feed-header-text"]');
    if (nameAnchor) {
      actorName = nameAnchor.innerText.trim();
      const headerTextContainer = nameAnchor.closest("div");
      if (headerTextContainer) {
        const textBlocks = headerTextContainer.querySelectorAll("p");
        if (textBlocks.length > 1) actorDescription = textBlocks[1].innerText.trim();
        if (textBlocks.length > 2) actorSubDescription = textBlocks[2].innerText.trim();
      }
    }
  } else {
    const nameElement = post.querySelector('[data-testid="User-Name"]');
    if (nameElement) {
      actorName = nameElement.innerText.split("\n")[0] || "Unknown";
      actorDescription = nameElement.innerText.split("\n")[1] || "No handle";
    }
  }

  const imageSelector = isLinkedIn ? '[data-view-name="feed-update-image"] img' : '[data-testid="tweetPhoto"] img';
  const imageContainer = post.querySelector(imageSelector);
  if (imageContainer) postImage = imageContainer.getAttribute("src");

  const analysis = await checkForCringe({
    actorName,
    actorDescription,
    actorSubDescription,
    postContent: commentaryElement.innerText.trim(),
    postImage,
  });

  if (analysis && analysis.isCringe) {
    const { filterMode } = await new Promise((resolve) => {
      chrome.storage.sync.get(["filterMode"], (data) => {
        resolve({ filterMode: data.filterMode || "blur" });
      });
    });
    cringeGuardThisPost(post, filterMode, analysis.reason);
    updateCringeStats(post.innerText);
  }
}

function cringeGuardExistingPosts() {
  startHeartbeat("scan");
  const isLinkedIn = window.location.hostname.includes("linkedin.com");
  const posts = isLinkedIn
    ? document.querySelectorAll('div[data-view-name="feed-full-update"], div.feed-shared-update-v2, div[data-urn]')
    : document.querySelectorAll('article[data-testid="tweet"]');

  if (posts.length === 0) {
    console.warn(`[Bloom Scroll] No ${isLinkedIn ? 'LinkedIn' : 'X'} posts found in initial scan`);
  }
  for (const post of posts) {
    processPost(post);
  }
}

function observeNewPosts() {
  startHeartbeat("observer");
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const isLinkedIn = window.location.hostname.includes("linkedin.com");
            const postSelector = isLinkedIn
              ? 'div[data-view-name="feed-full-update"], div.feed-shared-update-v2, div[data-urn]'
              : 'article[data-testid="tweet"]';

            const postContainers = node.querySelectorAll(postSelector);
            postContainers.forEach((postContainer) => processPost(postContainer));

            // Check the node itself if it's a post
            if (node.matches && node.matches(postSelector)) {
              processPost(node);
            }
          }
        });
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

initExtension();
