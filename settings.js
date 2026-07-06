/* global TrelloPowerUp */

// >>> Set this to your own Trello Power-Up API key (from https://trello.com/power-ups/admin) <<<
var APP_KEY = 'YOUR_TRELLO_APP_KEY';

var t = TrelloPowerUp.iframe();

var authUrl = 'https://trello.com/1/authorize' +
  '?expiration=never' +
  '&scope=read,write' +
  '&response_type=token' +
  '&name=CSV%20Import%20Power-Up' +
  '&key=' + APP_KEY;

document.getElementById('authLink').href = authUrl;

// Pre-fill if a token already exists
t.get('member', 'private', 'trelloToken').then(function (existing) {
  if (existing) document.getElementById('tokenInput').value = existing;
});

document.getElementById('saveBtn').addEventListener('click', function () {
  var token = document.getElementById('tokenInput').value.trim();
  if (!token) return;
  t.set('member', 'private', 'trelloToken', token).then(function () {
    document.getElementById('status').textContent = 'Token saved. You can close this popup.';
  });
});
