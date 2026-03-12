// content.js — WhatsApp Web Group Contact Extractor v3 (robust)

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fullScroll(container) {
  container.scrollTop = 0;
  await sleep(400);
  let last = -1;
  for (let i = 0; i < 60; i++) {
    container.scrollTop += 250;
    await sleep(250);
    if (container.scrollTop === last) break;
    last = container.scrollTop;
  }
  container.scrollTop = 0;
  await sleep(400);
}

function findScrollableInPanel(panel) {
  const divs = [...panel.querySelectorAll('div')];
  return divs.find(el => {
    const s = window.getComputedStyle(el);
    return (s.overflowY === 'scroll' || s.overflowY === 'auto') &&
           el.scrollHeight > el.clientHeight + 10 &&
           el.clientHeight > 100;
  }) || null;
}

function parseRow(el) {
  const phonePattern = /^\+?[\d][\d\s\-().]{5,20}$/;
  const spans = [...el.querySelectorAll('span')].filter(s =>
    s.children.length === 0 && s.innerText.trim().length > 0
  );

  let name = '';
  let phone = '';

  for (const span of spans) {
    const txt = span.innerText.trim();
    if (phonePattern.test(txt) && !phone) {
      phone = txt;
    } else if (!name && txt.length > 1 && txt !== 'You' && !/^(admin|Admin)$/.test(txt)) {
      // Prefer title attribute for names
      name = span.getAttribute('title') || txt;
    }
  }

  if (!name) {
    const titled = el.querySelector('[title]');
    if (titled) name = titled.getAttribute('title');
  }

  return (name || phone) ? { name, phone } : null;
}

async function extractGroupContacts() {
  // Find right-side group info panel
  const panel =
    document.querySelector('[data-testid="contact-info-drawer"]') ||
    // fallback: rightmost panel-like div
    [...document.querySelectorAll('#app [tabindex]')].find(el =>
      el.getBoundingClientRect().left > window.innerWidth / 2 && el.scrollHeight > 400
    );

  if (!panel) {
    return { error: "Group info panel not found. Click the group name at the top of the chat to open it, then try again." };
  }

  // Scroll to load all members
  const scrollable = findScrollableInPanel(panel);
  if (scrollable) await fullScroll(scrollable);

  // Try known data-testid selectors first
  let rows = [
    ...document.querySelectorAll('[data-testid="participant-list-item"]'),
    ...document.querySelectorAll('[data-testid="cell-frame-container"]'),
  ].filter(el => panel.contains(el));

  // Fallback: find rows by structure (div containing phone-like span)
  if (rows.length === 0) {
    const phonePattern = /^\+?[\d][\d\s\-().]{5,20}$/;
    const allDivs = [...panel.querySelectorAll('div')];
    rows = allDivs.filter(div => {
      const directSpans = [...div.querySelectorAll('span')].filter(s => s.children.length === 0);
      return directSpans.some(s => phonePattern.test(s.innerText.trim()));
    });
    // deduplicate: remove children of already-selected elements
    rows = rows.filter(el => !rows.some(other => other !== el && other.contains(el)));
  }

  if (rows.length === 0) {
    const snippet = panel.innerText.slice(0, 300).replace(/\n+/g, ' ');
    return {
      error: `Members section not loaded yet. Please:\n1. Scroll down in the group info panel until member names appear\n2. Click Extract again\n\nPanel preview: "${snippet}"`
    };
  }

  const contacts = [];
  const seen = new Set();

  for (const row of rows) {
    const c = parseRow(row);
    if (c) {
      const key = `${c.name}||${c.phone}`;
      if (!seen.has(key)) { seen.add(key); contacts.push(c); }
    }
  }

  if (contacts.length === 0) {
    return { error: "Found member rows but couldn't read data. Try scrolling to make participants visible, then extract again." };
  }

  return { contacts };
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'extractContacts') {
    extractGroupContacts().then(sendResponse);
    return true;
  }
});
