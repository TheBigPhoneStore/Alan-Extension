console.log("Ticket reply script loaded and observing for changes...");

const scriptUrl = "https://script.google.com/macros/s/AKfycbwup1NcdPs9oqNSxDHw-yDiQrFkI2pSVi9Wgt_K2v7hvbeBB3HGmK0mgfXclYSw9VZ7/exec";
let currentRowNumber = null;
let currentSuggestedReply = null;

const buttonListenersAdded = new WeakSet();
const editorListenersAdded = new WeakSet();

async function getTicketReply(ticketId) {
    currentRowNumber = null;
    currentSuggestedReply = "Loading...";
    updatePlaceholder();

    const url = new URL(scriptUrl);
    url.searchParams.append("action", "getReply");
    url.searchParams.append("ticketId", ticketId);

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const responseText = await response.text();
        try {
            const data = JSON.parse(responseText);
            if (data.reply && data.rowNumber) {
                currentRowNumber = data.rowNumber;
                currentSuggestedReply = data.reply;
            } else {
                currentSuggestedReply = "No suggested reply found for this ticket.";
            }
        } catch (e) {
            currentSuggestedReply = responseText;
        }
    } catch (error) {
        console.error("Error fetching ticket reply:", error);
        currentSuggestedReply = "Error fetching reply. See console for details.";
    }
}

async function markReplyAsSent() {
    if (currentRowNumber === null) {
        console.warn("No row number available, cannot mark as sent.");
        return;
    }

    const editor = document.querySelector('div[data-testid="rich-text-editor"]');
    const currentTextInEditor = editor ? editor.textContent : "";

    // Check for amendment by comparing the current text with the suggestion.
    // This is more reliable than listening for input events.
    if (currentTextInEditor !== currentSuggestedReply) {
        console.log("Text has been modified. Marking as amended first.");
        await markReplyAsAmended();
    }

    console.log(`Marking row ${currentRowNumber} as sent.`);
    const url = new URL(scriptUrl);
    url.searchParams.append("action", "markSent");
    url.searchParams.append("row", currentRowNumber);
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        console.log("Mark as sent result:", await response.text());
    } catch (error) {
        console.error("Error marking reply as sent:", error);
    }
}

async function markReplyAsAmended() {
    if (currentRowNumber === null) return;
    console.log(`Marking row ${currentRowNumber} as amended.`);
    const url = new URL(scriptUrl);
    url.searchParams.append("action", "markAmended");
    url.searchParams.append("row", currentRowNumber);
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        console.log("Mark as amended result:", await response.text());
    } catch (error) {
        console.error("Error marking reply as amended:", error);
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

function initialize() {
    const ticketIdMatch = window.location.pathname.match(/\/(\d+)$/);
    if (ticketIdMatch && ticketIdMatch[1]) {
        const ticketId = ticketIdMatch[1];
        if (document.body.dataset.currentTicketId !== ticketId) {
            document.body.dataset.currentTicketId = ticketId;
            getTicketReply(ticketId);
        }
    }

    updatePlaceholder();

    const buttonXPath = "//button[.//span[contains(text(), 'Submit as')] and .//span[text()='Solved']]";
    const sendButton = getElementByXpath(buttonXPath);
    if (sendButton && !buttonListenersAdded.has(sendButton)) {
        sendButton.addEventListener("click", markReplyAsSent);
        buttonListenersAdded.add(sendButton);
    }

    const editor = document.querySelector('div[data-testid="rich-text-editor"]');
    if (editor && !editorListenersAdded.has(editor)) {
        editor.addEventListener('dblclick', () => {
            const hasText = editor.querySelector('span[data-slate-string="true"]');
            if (!hasText && currentSuggestedReply) {
                simulateTyping(editor, currentSuggestedReply);
            }
        });
        editorListenersAdded.add(editor);
    }
}

const observer = new MutationObserver(initialize);
observer.observe(document.body, { childList: true, subtree: true });

initialize();
