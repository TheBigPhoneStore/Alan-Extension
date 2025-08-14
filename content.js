console.log("Ticket reply script loaded and observing for changes...");

const scriptUrl = "https://script.google.com/macros/s/AKfycbwup1NcdPs9oqNSxDHw-yDiQrFkI2pSVi9Wgt_K2v7hvbeBB3HGmK0mgfXclYSw9VZ7/exec";
let currentRowNumber = null;
let currentSuggestedReply = null;
let suggestionUsed = false; // Track if the suggestion was inserted

const buttonListenersAdded = new WeakSet();
const editorListenersAdded = new WeakSet();

function removeSignature(text) {
    // This regex looks for the signature at the end of the string,
    // allowing for variable whitespace (including newlines) between the parts.
    const signatureRegex = /Kind Regards,\s*Alan\s*The Big Phone Store\s*$/;
    return text.replace(signatureRegex, "").trim();
}

async function getTicketReply(ticketId, numIframes) {
    currentRowNumber = null;
    currentSuggestedReply = "Loading...";
    suggestionUsed = false; // Reset for new ticket
    updatePlaceholder();

    const url = new URL(scriptUrl);
    url.searchParams.append("action", "getReply");
    url.searchParams.append("ticketId", ticketId);
    url.searchParams.append("messageCount", numIframes);

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const responseText = await response.text();
        try {
            const data = JSON.parse(responseText);
            if (data.reply && data.rowNumber) {
                currentRowNumber = data.rowNumber;
                currentSuggestedReply = removeSignature(data.reply);
            } else {
                currentSuggestedReply = "No suggested reply found for this ticket.";
            }
        } catch (e) {
            currentSuggestedReply = responseText;
        }
    } catch (error) {
        console.error("Error fetching ticket reply:", error);
        currentSuggestedReply = "Error fetching reply. See console for details.";
    } finally {
        updatePlaceholder();
    }
}

async function markReply() {
    if (!suggestionUsed) {
        console.log("Suggestion not used, not marking as sent via extension.");
        return;
    }

    if (currentRowNumber === null) {
        console.warn("No row number available, cannot mark as sent.");
        return;
    }

    const editor = document.querySelector('div[data-testid="rich-text-editor"]');
    const currentTextInEditor = editor ? editor.textContent : "";

    const isPlaceholder = currentSuggestedReply.includes("No suggested reply") ||
                          currentSuggestedReply.includes("Loading...") ||
                          currentSuggestedReply.includes("Error fetching reply");

    if (!isPlaceholder) {
        if (currentTextInEditor !== currentSuggestedReply) {
            console.log("Text has been modified. Marking as amended first.");
            await markReplyAsAmended(currentRowNumber);
        } else {
            await markReplyAsSent(currentRowNumber);
        }
    }
}

async function markReplyAsSent(rowNumber) {
    console.log(`Marking row ${rowNumber} as sent.`);
    if (rowNumber === null) {
        console.warn("No row number available, cannot mark as sent.");
        return;
    }

    const payload = {
        action: "markSent",
        rowNumber: rowNumber
    };

    try {
        await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        console.log("Mark as sent request successfully sent.");
    } catch (error) {
        console.error("Error marking reply as sent:", error);
    }
}

async function markReplyAsAmended(rowNumber) {
    if (rowNumber === null) {
        console.warn("No row number available, cannot mark as amended.");
        return;
    }

    const editor = document.querySelector('div[data-testid="rich-text-editor"]');
    const amendedReply = editor ? editor.textContent.trim() : "";

    // If there's an amended reply, send it via POST.
    if (amendedReply) {
        console.log(`Sending amended reply for row ${currentRowNumber}...`);
        const payload = {
            action: "markAmended",
            rowNumber: rowNumber,
            amendedReply: amendedReply
        };

        try {
            await fetch(scriptUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            console.log("Amended reply successfully sent.");
        } catch (error) {
            console.error("Error sending amended reply:", error);
        }
    }
}

function updatePlaceholder() {
    const placeholder = document.querySelector('[data-slate-placeholder="true"]');
    if (placeholder && currentSuggestedReply && placeholder.textContent !== currentSuggestedReply) {
        placeholder.textContent = currentSuggestedReply;
    }
}

function simulateTyping(editor, text) {
    editor.focus();
    const event = new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: text,
        bubbles: true,
        cancelable: true,
    });
    editor.dispatchEvent(event);
}

function getElementByXpath(path) {
    return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

async function initialize() {
    const ticketIdMatch = window.location.pathname.match(/\/(\d+)$/);
    if (ticketIdMatch && ticketIdMatch[1]) {
        const ticketId = ticketIdMatch[1];
        if (document.body.dataset.currentTicketId !== ticketId) {
            // Mark ticket as being processed to prevent re-entry from other mutations
            document.body.dataset.currentTicketId = ticketId;

            // Poll for the iframe to ensure it's loaded before we count it.
            // Tidio loads content dynamically, so we need to wait.
            const selector = 'iframe[title="Email"]';
            let emailIframes = [];
            let attempts = 0;
            const maxAttempts = 10; // Try for up to 5 seconds (10 * 500ms)

            while (attempts < maxAttempts) {
                emailIframes = document.querySelectorAll(selector);
                if (emailIframes.length > 0) break; // Found it, exit loop
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
            }

            const numIframes = emailIframes.length;
            console.log(`Found ${numIframes} iframe(s) with title='email' for ticket ${ticketId}.`);
            getTicketReply(ticketId, numIframes);
        }
    }

    updatePlaceholder();

    const buttonXPath = "//button[.//span[contains(text(), 'Submit as')] and .//span[text()='Solved']]";
    const sendButton = getElementByXpath(buttonXPath);
    if (sendButton && !buttonListenersAdded.has(sendButton)) {
        sendButton.addEventListener("click", markReply);
        buttonListenersAdded.add(sendButton);
    }

    const editor = document.querySelector('div[data-testid="rich-text-editor"]');
    if (editor && !editorListenersAdded.has(editor)) {
        editor.addEventListener('dblclick', () => {
            const hasText = editor.querySelector('span[data-slate-string="true"]');
            if (!hasText && currentSuggestedReply) {
                simulateTyping(editor, currentSuggestedReply);
                suggestionUsed = true;
            }
        });

        const resetSuggestionUsedIfEmpty = () => {
            const hasText = editor.querySelector('span[data-slate-string="true"]');
            if (!hasText && suggestionUsed) {
                console.log("Editor cleared, resetting suggestionUsed flag.");
                suggestionUsed = false;
            }
        };

        // Listen for various events to robustly reset suggestionUsed if the editor is cleared
        editor.addEventListener('input', resetSuggestionUsedIfEmpty);
        editor.addEventListener('keyup', resetSuggestionUsedIfEmpty);
        editor.addEventListener('blur', resetSuggestionUsedIfEmpty);

        editorListenersAdded.add(editor);
    }
}

const observer = new MutationObserver(() => initialize().catch(console.error));
observer.observe(document.body, { childList: true, subtree: true });

initialize().catch(console.error);