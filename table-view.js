/* global TrelloPowerUp */

var t = TrelloPowerUp.iframe();
var contentEl = document.getElementById('content');

function escapeHtml(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

t.get('card', 'shared', 'tableMeta').then(function (metaStr) {
  if (!metaStr) {
    contentEl.textContent = 'No table saved yet. Use "Import CSV/Excel" to add one.';
    return;
  }
  var meta = JSON.parse(metaStr);
  var chunkKeys = [];
  for (var i = 0; i < meta.chunkCount; i++) chunkKeys.push('tableChunk_' + i);

  Promise.all(chunkKeys.map(function (k) { return t.get('card', 'shared', k); }))
    .then(function (chunks) {
      var rows = [];
      chunks.forEach(function (c) { if (c) rows = rows.concat(JSON.parse(c)); });

      var html = '<div class="wrap"><table><thead><tr>';
      meta.headers.forEach(function (h) { html += '<th>' + escapeHtml(h) + '</th>'; });
      html += '</tr></thead><tbody>';
      rows.forEach(function (row) {
        html += '<tr>';
        meta.headers.forEach(function (h) { html += '<td>' + escapeHtml(row[h]) + '</td>'; });
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      contentEl.innerHTML = html;
      contentEl.className = '';
    });
});
