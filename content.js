console.log("content.js script loaded and observing for changes...");

const customPlaceholderText = 'Your custom placeholder text';

// Use Sets to keep track of processed elements without modifying the DOM
const processedPlaceholders = new WeakSet();
const listenersAdded = new WeakSet();
const editedEditors = new WeakSet();

/**
 * Simulates typing text into a contenteditable element by dispatching
 * a single 'beforeinput' event for the entire string.
 * @param {HTMLElement} editor The contenteditable element to type into.
 * @param {string} text The text to type.
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
 * Changes the visible placeholder text of a Slate editor.
 * @param {HTMLElement} placeholderElement The placeholder element to modify.
 */
function replacePlaceholder(placeholderElement) {
    if (processedPlaceholders.has(placeholderElement)) return;

    placeholderElement.textContent = customPlaceholderText;
    processedPlaceholders.add(placeholderElement);
    console.log('Placeholder text replaced.');
}

function addEventListeners(editor) {
    if (listenersAdded.has(editor)) return;

    // Double-click to insert text only if the editor is empty
    editor.addEventListener('dblclick', () => {
        const hasText = editor.querySelector('span[data-slate-string="true"]');

        if (!hasText) {
            console.log('Editor is empty. Inserting text...');
            simulateTyping(editor, customPlaceholderText);
            editedEditors.delete(editor); // Mark as programmatically filled
        } else {
            console.log('Editor is not empty. No action taken.');
        }
    });

    // Listen for actual user input to track edits
    editor.addEventListener('input', () => {
        if (!editedEditors.has(editor)) {
            editedEditors.add(editor);
            console.log('User has edited the text.');
        }
    });

    listenersAdded.add(editor);
    console.log('Event listeners (dblclick, input) added to an editor.');
}

function processElements() {
    // Task 1: Replace placeholder text
    const placeholders = document.querySelectorAll('[data-slate-placeholder="true"]');
    placeholders.forEach(replacePlaceholder);

    // Task 2: Add event listeners to editors
    const editors = document.querySelectorAll('div[data-testid="rich-text-editor"]');
    editors.forEach(addEventListeners);
}

const observer = new MutationObserver(() => {
    processElements();
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial run
processElements();
