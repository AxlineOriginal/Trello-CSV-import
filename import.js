/* global TrelloPowerUp, Papa, XLSX */

// >>> Must match the key used in settings.js <<<
var APP_KEY = 'YOUR_TRELLO_APP_KEY';

var t = TrelloPowerUp.iframe();

var currentHeaders = [];
var currentRows = []; // array of objects keyed by header

var fileInput = document.getElementById('fileInput');
var previewEl = document.getElementById('preview');
var saveBtn = document.getElementById('saveBtn');
var saveStatus = document.getElementById('saveStatus');
var listSelect = document.getElementById('listSelect');
var titleColSelect = document.getElementById('titleColSelect');
var convertBtn = document.getElementById('convertBtn');
var convertStatus = document.getElementById('convertStatus');

// ---------- Populate board lists for the "convert to cards" target ----------
t.board('lists').then(function (board) {
  (board.lists || []).forEach(function (list) {
    var opt = document.createElement('option');
    opt.value = list.id;
    opt.textContent = list.name;
    listSelect.appendChild(opt);
  });
});

// ---------- File parsing ----------
fileInput.addEventListener('change', function (e) {
  var file = e.target.files[0];
  if (!file) return;
  var name = file.name.toLowerCase();

  if (name.endsWith('.csv')) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        setData(results.meta.fields || [], results.data);
      }
    });
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    var reader = new FileReader();
    reader.onload = function (evt) {
      var wb = XLSX.read(evt.target.result, { type: 'array' });
      var sheet = wb.Sheets[wb.SheetNames[0]];
      var rows2d = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      var headers = (rows2d[0] || []).map(String);
      var objRows = rows2d.slice(1).map(function (r) {
        var o = {};
        headers.forEach(function (h, i) { o[h] = r[i] !== undefined ? r[i] : ''; });
        return o;
      });
      setData(headers, objRows);
    };
    reader.readAsArrayBuffer(file);
  } else {
    alert('Unsupported file type. Please use .csv, .xlsx or .xls');
  }
});

function setData(headers, rows) {
  currentHeaders = headers;
  currentRows = rows;
  renderPreview();
  populateTitleColumn();
  saveBtn.disabled = rows.length === 0;
  convertBtn.disabled = rows.length === 0;
}

function renderPreview() {
  var maxPreviewRows = 200;
  var html = '<table><thead><tr>';
  currentHeaders.forEach(function (h) { html += '<th>' + escapeHtml(h) + '</th>'; });
  html += '</tr></thead><tbody>';
  currentRows.slice(0, maxPreviewRows).forEach(function (row) {
    html += '<tr>';
    currentHeaders.forEach(function (h) { html += '<td>' + escapeHtml(row[h]) + '</td>'; });
    html += '</tr>';
  });
  html += '</tbody></table>';
  if (currentRows.length > maxPreviewRows) {
    html += '<div class="hint">Showing first ' + maxPreviewRows + ' of ' + currentRows.length + ' rows (all rows are still saved/converted).</div>';
  }
  previewEl.innerHTML = html;
}

function populateTitleColumn() {
  titleColSelect.innerHTML = '';
  currentHeaders.forEach(function (h) {
    var opt = document.createElement('option');
    opt.value = h;
    opt.textContent = h;
    titleColSelect.appendChild(opt);
  });
}

function escapeHtml(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// ---------- Save table to card (chunked shared storage) ----------
saveBtn.addEventListener('click', function () {
  saveStatus.textContent = 'Saving...';
  saveStatus.className = 'status';

  // Clear any previous chunks first (read old meta to know how many existed)
  t.get('card', 'shared', 'tableMeta').then(function (oldMetaStr) {
    var clearOld = Promise.resolve();
    if (oldMetaStr) {
      var oldMeta = JSON.parse(oldMetaStr);
      var clears = [];
      for (var i = 0; i < oldMeta.chunkCount; i++) {
        clears.push(t.remove('card', 'shared', 'tableChunk_' + i));
      }
      clearOld = Promise.all(clears);
    }
    return clearOld;
  }).then(function () {
    var CHUNK_CHAR_LIMIT = 3500; // stay safely under Trello's ~4096/key limit
    var chunks = [];
    var current = [];
    var currentSize = 2; // for []

    currentRows.forEach(function (row) {
      var rowStr = JSON.stringify(row);
      if (currentSize + rowStr.length + 1 > CHUNK_CHAR_LIMIT && current.length > 0) {
        chunks.push(current);
        current = [];
        currentSize = 2;
      }
      current.push(row);
      currentSize += rowStr.length + 1;
    });
    if (current.length > 0) chunks.push(current);

    var writes = chunks.map(function (chunk, i) {
      return t.set('card', 'shared', 'tableChunk_' + i, JSON.stringify(chunk));
    });

    return Promise.all(writes).then(function () {
      var meta = {
        headers: currentHeaders,
        chunkCount: chunks.length,
        fileName: fileInput.files[0] ? fileInput.files[0].name : ''
      };
      return t.set('card', 'shared', 'tableMeta', JSON.stringify(meta));
    });
  }).then(function () {
    saveStatus.textContent = 'Saved ' + currentRows.length + ' rows to the card.';
    saveStatus.className = 'status ok';
  }).catch(function (err) {
    saveStatus.textContent = 'Error saving: ' + err.message;
    saveStatus.className = 'status err';
  });
});

// ---------- Convert rows to cards via Trello REST API ----------
convertBtn.addEventListener('click', function () {
  var listId = listSelect.value;
  var titleCol = titleColSelect.value;
  if (!listId) {
    convertStatus.textContent = 'No list selected.';
    convertStatus.className = 'status err';
    return;
  }

  t.get('member', 'private', 'trelloToken').then(function (token) {
    if (!token) {
      convertStatus.innerHTML = 'No Trello token found. Open the board button "Trello API Token" first.';
      convertStatus.className = 'status err';
      return;
    }
    if (APP_KEY === 'YOUR_TRELLO_APP_KEY') {
      convertStatus.textContent = 'Set APP_KEY in import.js (and settings.js) to your Trello Power-Up key first.';
      convertStatus.className = 'status err';
      return;
    }

    convertBtn.disabled = true;
    createCardsSequentially(currentRows, 0, listId, titleCol, token);
  });
});

function createCardsSequentially(rows, index, listId, titleCol, token) {
  if (index >= rows.length) {
    convertStatus.textContent = 'Done. Created ' + rows.length + ' cards.';
    convertStatus.className = 'status ok';
    convertBtn.disabled = false;
    return;
  }

  var row = rows[index];
  var title = row[titleCol] ? String(row[titleCol]) : ('Row ' + (index + 1));
  var descLines = currentHeaders
    .filter(function (h) { return h !== titleCol; })
    .map(function (h) { return '**' + h + '**: ' + (row[h] == null ? '' : row[h]); });
  var desc = descLines.join('\n');

  var params = new URLSearchParams({
    key: APP_KEY,
    token: token,
    idList: listId,
    name: title,
    desc: desc
  });

  convertStatus.textContent = 'Creating card ' + (index + 1) + ' of ' + rows.length + '...';
  convertStatus.className = 'status';

  fetch('https://api.trello.com/1/cards?' + params.toString(), { method: 'POST' })
    .then(function (res) {
      if (!res.ok) {
        return res.text().then(function (txt) { throw new Error(txt); });
      }
      // Trello rate limit friendliness: small delay between requests
      return new Promise(function (resolve) { setTimeout(resolve, 150); });
    })
    .then(function () {
      createCardsSequentially(rows, index + 1, listId, titleCol, token);
    })
    .catch(function (err) {
      convertStatus.textContent = 'Stopped at row ' + (index + 1) + ': ' + err.message;
      convertStatus.className = 'status err';
      convertBtn.disabled = false;
    });
}
