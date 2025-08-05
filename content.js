console.log("Ticket reply script loaded and observing for changes...");

const scriptUrl = "https://script.google.com/macros/s/AKfycbwup1NcdPs9oqNSxDHw-yDiQrFkI2pSVi9Wgt_K2v7hvbeBB3HGmK0mgfXclYSw9VZ7/exec";
let currentRowNumber = null;
let currentSuggestedReply = null; // Store the fetched reply

// Use WeakSets to prevent adding multiple listeners
const buttonListenersAdded = new WeakSet();
const editorListenersAdded = new WeakSet();

/**
 * Fetches the reply for a given ticket ID.
 * @param {string} ticketId The ID of the ticket.
 */
async function getTicketReply(ticketId) {
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
                console.log(`Reply found for ticket ${ticketId}:`, data.reply);
                currentRowNumber = data.rowNumber;
                currentSuggestedReply = data.reply;
            } else {
                currentSuggestedReply = "No suggested reply found for this ticket.";
            }
        } catch (e) {
            console.log(`Received plain text response for ticket ${ticketId}: ${responseText}`);
            currentSuggestedReply = responseText;
            currentRowNumber = null;
        }
    } catch (error) {
        console.error("Error fetching ticket reply:", error);
        currentSuggestedReply = "Error fetching reply. See console for details.";
    }
    // The observer will call updatePlaceholder, so we don't need to do it here.
}

/**
 * Marks the current row as sent.
 */
async function markReplyAsSent() {
    if (currentRowNumber === null) {
        console.warn("No row number available to mark as sent.");
        return;
    }

    const url = new URL(scriptUrl);
    url.searchParams.append("action", "markSent");
    url.searchParams.append("row", currentRowNumber);

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.text();
        console.log("Mark as sent result:", result);
    } catch (error) {
        console.error("Error marking reply as sent:", error);
    }
}

/**
 * If the placeholder is visible, ensures its text matches the stored reply.
 */
function updatePlaceholder() {
    const placeholder = document.querySelector('[data-slate-placeholder="true"]');
    if (placeholder && currentSuggestedReply && placeholder.textContent !== currentSuggestedReply) {
        placeholder.textContent = currentSuggestedReply;
    }
}

/**
 * Simulates typing text into the editor.
 * @param {HTMLElement} editor The contenteditable element.
 * @param {string} text The text to insert.
 */
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

/**
 * Finds an element using an XPath expression.
 * @param {string} path The XPath expression.
 * @returns {Node | null}
 */
function getElementByXpath(path) {
    return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

/**
 * Main function to initialize the script logic on the page.
 */
function initialize() {
    const ticketIdMatch = window.location.pathname.match(/\/(\d+)$/);
    if (ticketIdMatch && ticketIdMatch[1]) {
        const ticketId = ticketIdMatch[1];
        if (document.body.dataset.currentTicketId !== ticketId) {
            document.body.dataset.currentTicketId = ticketId;
            console.log(`Detected new Ticket ID: ${ticketId}`);
            getTicketReply(ticketId);
        }
    }

    // This will run on every DOM change, ensuring the placeholder is always correct.
    updatePlaceholder();

    // Add listener to the submit button
    const buttonXPath = "//button[.//span[contains(text(), 'Submit as')] and .//span[text()='Solved']]";
    const sendButton = getElementByXpath(buttonXPath);
    if (sendButton && !buttonListenersAdded.has(sendButton)) {
        sendButton.addEventListener("click", markReplyAsSent);
        buttonListenersAdded.add(sendButton);
        console.log("'Mark as sent' listener added to the submit button.");
    }

    // Add listener to the text editor for double-click functionality
    const editor = document.querySelector('div[data-testid="rich-text-editor"]');
    if (editor && !editorListenersAdded.has(editor)) {
        editor.addEventListener('dblclick', () => {
            const hasText = editor.querySelector('span[data-slate-string="true"]');
            if (!hasText && currentSuggestedReply) {
                console.log('Editor is empty. Inserting placeholder text...');
                simulateTyping(editor, currentSuggestedReply);
            }
        });
        editorListenersAdded.add(editor);
        console.log("Double-click listener added to the editor.");
    }
}

const observer = new MutationObserver(() => {
    initialize();
});

observer.observe(document.body, { childList: true, subtree: true });

initialize();