/* global TrelloPowerUp */

var TABLE_ICON = 'https://cdn-icons-png.flaticon.com/128/8242/8242996.png';

// Reconstruct a saved table (headers + rows) from chunked shared storage.
// Storage is chunked because Trello limits each shared key to ~4096 chars.
function loadTable(t) {
  return t.get('card', 'shared', 'tableMeta').then(function (meta) {
    if (!meta) return null;
    var parsedMeta = JSON.parse(meta);
    var chunkKeys = [];
    for (var i = 0; i < parsedMeta.chunkCount; i++) {
      chunkKeys.push('tableChunk_' + i);
    }
    return Promise.all(
      chunkKeys.map(function (k) { return t.get('card', 'shared', k); })
    ).then(function (chunks) {
      var rows = [];
      chunks.forEach(function (c) {
        if (c) rows = rows.concat(JSON.parse(c));
      });
      return {
        headers: parsedMeta.headers,
        fileName: parsedMeta.fileName,
        rows: rows
      };
    });
  });
}

TrelloPowerUp.initialize({
  'card-badges': function (t, opts) {
    return loadTable(t).then(function (table) {
      if (!table) return [];
      return [{
        text: table.rows.length + ' rows',
        icon: TABLE_ICON
      }];
    });
  },

  'card-buttons': function (t, opts) {
    return [{
      icon: TABLE_ICON,
      text: 'Import CSV/Excel',
      callback: function (t) {
        return t.popup({
          title: 'Import CSV / Excel',
          url: './import.html',
          height: 560
        });
      }
    }];
  },

  'card-back-section': function (t, opts) {
    return loadTable(t).then(function (table) {
      if (!table) return null;
      return {
        title: 'Data Table' + (table.fileName ? ' — ' + table.fileName : ''),
        icon: TABLE_ICON,
        content: {
          type: 'iframe',
          url: t.signUrl('./table-view.html'),
          height: 260
        }
      };
    });
  },

  'board-buttons': function (t, opts) {
    return [{
      icon: TABLE_ICON,
      text: 'Trello API Token',
      callback: function (t) {
        return t.popup({
          title: 'Connect Trello API Token',
          url: './settings.html',
          height: 260
        });
      }
    }];
  }
});
