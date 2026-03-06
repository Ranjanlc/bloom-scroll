chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "CHECK_CRINGE") {
        const { apiKey, systemMessage, postContent } = request.data;
        console.log("[Bloom Scroll Background] Starting cringe check for post content length:", postContent.length);

        fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "grok-3-fast",
                messages: [
                    { role: "system", content: systemMessage },
                    {
                        role: "user",
                        content:
                            "Linkedin Post:\n\n" +
                            postContent +
                            "\n\nRespond EXACTLY in one line: if cringe, 'POST_IS_CRINGE: <one short reason>'; if not, 'POST_IS_NOT_CRINGE'.",
                    },
                ],
                temperature: 0.1,
            }),
        })
            .then((response) => {
                console.log("[Bloom Scroll Background] API response status:", response.status);
                return response.json();
            })
            .then((data) => {
                console.log("[Bloom Scroll Background] API data received:", !!data);
                sendResponse({ success: true, data });
            })
            .catch((error) => {
                console.error("[Bloom Scroll Background] Error fetching xAI API:", error);
                sendResponse({ success: false, error: error.message });
            });

        return true; // Keep message channel open for async response
    }
});
