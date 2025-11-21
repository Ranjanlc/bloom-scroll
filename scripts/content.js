function getApiKeyIfEnabled() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["groqApiKey", "isEnabled"], (data) => {
      if (data.isEnabled && data.groqApiKey) {
        resolve(data.groqApiKey);
      } else {
        console.warn("X AI API key not found or extension is disabled.");
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
      "X AI API key not found. Please set your API key in the extension settings."
    );
    return;
  }

  startHeartbeat("init");
  const host = location.hostname;
  if (host.includes("linkedin.com")) {
    cringeGuardExistingPostsLinkedIn();
    observeNewPostsLinkedIn();
  } else if (host.includes("twitter.com") || host.includes("x.com")) {
    cringeGuardExistingTweets();
    observeNewTweets();
  }
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

function cringeGuardThisPost(post, filterMode, reason, platform) {
  // 1. Find the container.
  // We try to find the specific update container, falling back to the passed node.
  const contentContainer =
    platform === "twitter"
      ? post.closest("article") || post
      : post.closest('div[data-view-name="feed-full-update"]') || post;

  // 2. Find the outer list item wrapper to handle removal cleanly
  const outerContainer =
    platform === "twitter"
      ? contentContainer.closest('div[data-testid="cellInnerDiv"]') ||
        contentContainer
      : contentContainer.closest('div[role="listitem"]') || contentContainer;

  if (outerContainer) {
    // --- REMOVE MODE ---
    if (filterMode === "remove") {
      outerContainer.style.display = "none";
      // Extra safety to ensure it doesn't take up space
      outerContainer.style.setProperty("display", "none", "important");
      console.log("[Bloom Scroll] Post removed");
      return;
    }

    // --- BLUR MODE ---

    // Check if we've already blurred this to prevent double-buttoning
    if (contentContainer.dataset.cringeGuarded === "true") return;
    contentContainer.dataset.cringeGuarded = "true";

    // Create the wrapper that will hold the text/images (to be blurred)
    const wrapper = document.createElement("div");

    // Move all existing children of the post into this wrapper
    while (contentContainer.firstChild) {
      wrapper.appendChild(contentContainer.firstChild);
    }

    // Style the Wrapper (The Blurred Content)
    wrapper.style.filter = "blur(12px)";
    wrapper.style.webkitFilter = "blur(12px)";
    wrapper.style.transition = "filter 0.3s ease, opacity 0.3s ease";
    wrapper.style.opacity = "0.6"; // Lower opacity helps obscure content further
    wrapper.style.width = "100%";
    wrapper.style.height = "auto"; // Ensure it takes up natural height
    wrapper.style.pointerEvents = "none"; // Prevent clicking links while blurred

    // Style the Container (The Reference Point)
    // IMPORTANT: We force display: block to break any flex/grid rules that might
    // misplace our absolute button.
    contentContainer.style.position = "relative";
    contentContainer.style.display = "block";
    contentContainer.style.minHeight = "150px"; // Force some height so 50% top works even if empty
    contentContainer.style.overflow = "hidden"; // Keeps button inside rounded corners

    // Create the Button
    const button = document.createElement("button");
    button.innerText = "Click to View";

    // Robust Centering CSS
    button.style.position = "absolute";
    button.style.top = "50%";
    button.style.left = "50%";
    button.style.transform = "translate(-50%, -50%)";
    button.style.zIndex = "100"; // High Z-index to sit on top

    // Button Visuals
    button.style.backgroundColor =
      platform === "twitter" ? "#1d9bf0" : "#0a66c2";
    button.style.color = "white";
    button.style.border = "none";
    button.style.padding = "10px 20px";
    button.style.fontSize = "16px";
    button.style.fontWeight = "600";
    button.style.borderRadius = "24px";
    button.style.cursor = "pointer";
    button.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
    button.style.transition = "transform 0.1s ease, background-color 0.2s";

    // Hover Effects
    button.onmouseover = () => {
      button.style.backgroundColor = "#004182";
      button.style.transform = "translate(-50%, -50%) scale(1.05)";
    };
    button.onmouseout = () => {
      button.style.backgroundColor = "#0a66c2";
      button.style.transform = "translate(-50%, -50%) scale(1)";
    };

    let reasonBadge;
    // Click Handler
    button.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent clicking the post underneath
      e.preventDefault();

      // Reveal content
      wrapper.style.filter = "none";
      wrapper.style.webkitFilter = "none";
      wrapper.style.opacity = "1";
      wrapper.style.pointerEvents = "auto";

      // Remove button
      button.remove();
      if (reasonBadge) reasonBadge.remove();

      // Reset container styles strictly required for the layout to return to normal
      // We keep 'block' usually, but if layout breaks, we can unset it.
      // Usually leaving it as block is fine for feed updates.
    });

    // Reason badge
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

    // Append elements back to the container
    contentContainer.appendChild(wrapper);
    contentContainer.appendChild(button);
  }
}

async function checkForCringe({
  actorName,
  actorDescription,
  actorSubDescription,
  postContent,
  platform,
}) {
  // Cringe Rule: 0 - No Promoted Posts.
  if (
    actorDescription.toLowerCase().includes("promoted") ||
    actorSubDescription.toLowerCase().includes("promoted")
  ) {
    return { isCringe: true, reason: "Promoted content" };
  }

  // Cringe Rule: 1 - Contains muted words.
  const mutedWords = await getMutedWords();
  if (
    containsMutedWords(actorName, mutedWords) ||
    containsMutedWords(actorDescription, mutedWords) ||
    containsMutedWords(actorSubDescription, mutedWords) ||
    containsMutedWords(postContent, mutedWords)
  ) {
    return { isCringe: true, reason: "Contains muted words" };
  }

  const GROQ_API_URL = "https://api.x.ai/v1/chat/completions";
  const apiKey = await getApiKeyIfEnabled();
  if (!apiKey) return; // Stop execution if no API key

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
    criteria.push(
      "Contains misleading or out-of-context information, including scams, phishing, hoaxes, or deliberate misinformation"
    );
  if (filters.filterHarassment)
    criteria.push(
      "Contains trolling, cyberbullying, harassment, or personal attacks"
    );
  if (filters.filterSuperficiality)
    criteria.push(
      "Promotes an obviously inauthentic, overly-curated, or misleading version of the author"
    );
  if (filters.filterLowEffort)
    criteria.push(
      "Uses low-effort engagement like 'Tag 3 people' or 'like if you agree' with no substance or tech-related discussion"
    );
  if (filters.filterIntrusiveAds)
    criteria.push(
      "Brand promotional content or ads that are intrusive, disruptive, or irrelevant to the professional feed"
    );

  const SYSTEM_PROMPT_PREFIX =
    platform === "twitter"
      ? "You are a Twitter/X post analyzer. Determine if the post meets any of these criteria:"
      : "You are a LinkedIn post analyzer. Determine if the post meets any of these criteria:";
  const promptFromFilters =
    criteria.length > 0
      ? `${SYSTEM_PROMPT_PREFIX}\n- ${criteria.join(
          "\n- "
        )}\nIf any criteria are met, respond with POST_IS_CRINGE, otherwise POST_IS_NOT_CRINGE.`
      : platform === "twitter"
      ? "You are a Twitter/X post analyzer. No filters are active. Always respond with POST_IS_NOT_CRINGE."
      : "You are a LinkedIn post analyzer. No filters are active. Always respond with POST_IS_NOT_CRINGE.";

  const customPrompt = await getCustomPrompt();
  const systemMessage =
    customPrompt && customPrompt.trim().split(/\s+/).length >= 5
      ? customPrompt
      : promptFromFilters;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4-1-fast-non-reasoning",
        messages: [
          { role: "system", content: systemMessage },
          {
            role: "user",
            content:
              (platform === "twitter"
                ? "Twitter/X Post:\n\n"
                : "LinkedIn Post:\n\n") +
              postContent +
              "\n\nRespond EXACTLY in one line: if cringe, 'POST_IS_CRINGE: <one short reason>'; if not, 'POST_IS_NOT_CRINGE'.",
          },
        ],
        temperature: 0.1, // Lowering temperature for more consistent responses
      }),
    });

    const data = await response.json();
    if (data.error) {
      return { isCringe: false, reason: null };
    }

    const raw = (data.choices?.[0]?.message?.content || "").trim();
    const lower = raw.toLowerCase();
    if (lower.includes("post_is_cringe")) {
      const reason =
        raw.split(/post_is_cringe\s*:?/i)[1]?.trim() || "Cringe content";
      return { isCringe: true, reason };
    }
    return { isCringe: false, reason: null };
  } catch (error) {
    console.error("Error checking post:", error);
    return { isCringe: false, reason: null };
  }
}

const alreadyProcessedPosts = new Set();
async function processLinkedInPost(post) {
  startHeartbeat("process");

  // Updated Selector: Use data-view-name or data-testid as classes are now obfuscated
  const commentaryElement = post.querySelector(
    '[data-view-name="feed-commentary"], [data-testid="expandable-text-box"]'
  );

  if (!commentaryElement) {
    console.warn("[Bloom Scroll] LinkedIn selector miss commentary");
    return;
  }

  // Avoid reprocessing
  // Note: Determine if you want to track the post container or the text element.
  // Using the text element for the Set is safer if the DOM updates the container.
  if (alreadyProcessedPosts.has(commentaryElement)) {
    // console.warn("[Bloom Scroll] LinkedIn already processed");
    return;
  }
  alreadyProcessedPosts.add(commentaryElement);
  processedCount++;

  // Post metadata
  let actorName = "Unknown";
  let actorDescription = "No description";
  let actorSubDescription = "No sub-description";
  let postImage = "No Image";

  // Updated Logic: Anchor to the Author Name link which has a stable data attribute
  const nameAnchor = post.querySelector('a[data-view-name="feed-header-text"]');

  if (nameAnchor) {
    // 1. Extract Name
    actorName = nameAnchor.innerText.trim();

    // 2. Extract Description & Sub-description
    // Navigate up to the parent div that contains Name (p), Description (p), and Time (p)
    // Structure is usually: Div > [P(Name), P(Description), P(Time)]
    const headerTextContainer = nameAnchor.closest("div");

    if (headerTextContainer) {
      const textBlocks = headerTextContainer.querySelectorAll("p");

      // The Description is usually the immediate sibling paragraph after the name
      if (textBlocks.length > 1) {
        actorDescription = textBlocks[1].innerText.trim();
      }

      // The Sub-description (Time/Edited) is usually the next paragraph
      if (textBlocks.length > 2) {
        actorSubDescription = textBlocks[2].innerText.trim();
      }
    }
  }

  // 3. Extract Image (if present)
  // Looking for the main feed update image container
  const imageContainer = post.querySelector(
    '[data-view-name="feed-update-image"] img'
  );
  if (imageContainer) {
    postImage = imageContainer.getAttribute("src");
  }

  const analysis = await checkForCringe({
    actorName,
    actorDescription,
    actorSubDescription,
    postContent: commentaryElement.innerText.trim(),
    platform: "linkedin",
    postImage,
  });

  if (analysis && analysis.isCringe) {
    const { filterMode } = await new Promise((resolve) => {
      chrome.storage.sync.get(["filterMode"], (data) => {
        resolve({ filterMode: data.filterMode || "blur" });
      });
    });

    cringeGuardThisPost(post, filterMode, analysis.reason, "linkedin");
    updateCringeStats(post.innerText);
  }
}

function cringeGuardExistingPostsLinkedIn() {
  startHeartbeat("scan");
  const posts = document.querySelectorAll(
    'div[data-view-name="feed-full-update"]'
  );
  if (posts.length === 0) {
    console.warn("[Bloom Scroll] No LinkedIn posts found in initial scan");
  }
  for (const post of posts) {
    processLinkedInPost(post);
  }
}

function observeNewPostsLinkedIn() {
  startHeartbeat("observer");
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Updated selector based on the new HTML structure
            // Targets the main container of the feed update
            const postContainers = node.querySelectorAll(
              'div[data-view-name="feed-full-update"]'
            );

            if (postContainers.length === 0) {
              // Optional: Log suppressed to avoid console spam during lazy loading
              // console.warn("[Bloom Scroll] No post containers in added node");
            }

            postContainers.forEach((postContainer) => {
              processLinkedInPost(postContainer);
            });
          }
        });
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

async function processTwitterPost(post) {
  startHeartbeat("process");
  const textEl = post.querySelector('[data-testid="tweetText"], div[lang]');
  if (!textEl) return;
  if (alreadyProcessedPosts.has(textEl)) return;
  alreadyProcessedPosts.add(textEl);
  processedCount++;

  let actorName = "Unknown";
  let actorDescription = "";
  let actorSubDescription = "";

  const userNames = post.querySelector('div[data-testid="User-Names"]');
  if (userNames) {
    const nameSpan = userNames.querySelector("span");
    if (nameSpan) actorName = nameSpan.innerText.trim();
  }

  const spans = post.querySelectorAll("span");
  spans.forEach((s) => {
    const t = (s.innerText || "").trim().toLowerCase();
    if (t === "promoted") actorDescription = "Promoted";
  });

  const analysis = await checkForCringe({
    actorName,
    actorDescription,
    actorSubDescription,
    postContent: textEl.innerText.trim(),
    platform: "twitter",
  });

  if (analysis && analysis.isCringe) {
    const { filterMode } = await new Promise((resolve) => {
      chrome.storage.sync.get(["filterMode"], (data) => {
        resolve({ filterMode: data.filterMode || "blur" });
      });
    });

    cringeGuardThisPost(post, filterMode, analysis.reason, "twitter");
    updateCringeStats(post.innerText);
  }
}

function cringeGuardExistingTweets() {
  startHeartbeat("scan");
  const tweets = document.querySelectorAll(
    'article[data-testid="tweet"], article[role="article"]'
  );
  tweets.forEach((t) => processTwitterPost(t));
}

function observeNewTweets() {
  startHeartbeat("observer");
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const newTweets = node.querySelectorAll(
              'article[data-testid="tweet"], article[role="article"]'
            );
            newTweets.forEach((post) => processTwitterPost(post));
          }
        });
      }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

initExtension();
