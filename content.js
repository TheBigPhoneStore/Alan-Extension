console.log("content.js script loaded");

function replacePlaceholderText() {
  const newText = 'Your custom placeholder text';
  const placeholderElement = document.querySelector('[data-slate-placeholder="true"]');

  if (placeholderElement) {
    placeholderElement.textContent = newText;
    console.log('Placeholder text replaced successfully!');
    return true;
  } else {
    return false;
  }
}

const observer = new MutationObserver((mutationsList, observer) => {
    if (replacePlaceholderText()) {
        observer.disconnect();
        console.log('Disconnected MutationObserver.');
    }
});

observer.observe(document.body, { childList: true, subtree: true });

replacePlaceholderText();