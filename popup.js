// popup.js

let contacts = [];

const extractBtn = document.getElementById('extractBtn');
const exportRow  = document.getElementById('exportRow');
const csvBtn     = document.getElementById('csvBtn');
const jsonBtn    = document.getElementById('jsonBtn');
const statusEl   = document.getElementById('status');
const previewEl  = document.getElementById('preview');

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = type;
}

function showPreview(data) {
  previewEl.style.display = 'block';
  previewEl.innerHTML = data.slice(0, 10).map(c =>
    `<div class="row">
       <span class="name">${c.name || '(no name)'}</span>
       <span class="phone"> · ${c.phone || '(no number)'}</span>
     </div>`
  ).join('') + (data.length > 10 ? `<div class="row" style="color:#00a884">…and ${data.length - 10} more</div>` : '');
}

function toCSV(data) {
  const header = 'Name,Phone';
  const rows = data.map(c =>
    `"${(c.name  || '').replace(/"/g, '""')}","${(c.phone || '').replace(/"/g, '""')}"`
  );
  return [header, ...rows].join('\n');
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

extractBtn.addEventListener('click', async () => {
  extractBtn.disabled = true;
  setStatus('Extracting… (scroll may take a few seconds)');
  exportRow.style.display = 'none';
  previewEl.style.display = 'none';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.includes('web.whatsapp.com')) {
    setStatus('Please open WhatsApp Web first.', 'error');
    extractBtn.disabled = false;
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: 'extractContacts' }, response => {
    extractBtn.disabled = false;

    if (chrome.runtime.lastError) {
      setStatus('Could not reach page. Refresh WhatsApp Web and try again.', 'error');
      return;
    }

    if (!response) {
      setStatus('No response from page.', 'error');
      return;
    }

    if (response.error) {
      setStatus(response.error, 'error');
      return;
    }

    contacts = response.contacts;
    setStatus(`✓ Found ${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`, 'ok');
    exportRow.style.display = 'flex';
    showPreview(contacts);
  });
});

csvBtn.addEventListener('click', () => {
  if (!contacts.length) return;
  download('whatsapp_group_contacts.csv', toCSV(contacts), 'text/csv');
});

jsonBtn.addEventListener('click', () => {
  if (!contacts.length) return;
  download('whatsapp_group_contacts.json', JSON.stringify(contacts, null, 2), 'application/json');
});
