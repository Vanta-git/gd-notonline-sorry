(function () {
  'use strict';

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  onReady(function () {
    var api = window.__gdTwoJetWisp;
    var toolbar = document.getElementById('midbar');
    if (!api || !toolbar) return;

    var style = document.createElement('style');
    style.textContent =
      '#twojet-open{font:12px/1 monospace;color:#ccc;background:#0a0a0a;border:1px solid #2a2a2a;border-radius:4px;padding:4px 8px;cursor:pointer;white-space:nowrap}' +
      '#twojet-open:hover{color:#fff;border-color:#555}' +
      '#twojet-overlay{position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.78);font:13px/1.45 monospace;color:#ddd}' +
      '#twojet-overlay.open{display:flex}' +
      '#twojet-dialog{width:min(520px,96vw);max-height:85vh;overflow:auto;background:#0b0b0b;border:1px solid #343434;border-radius:9px;padding:18px;box-shadow:0 16px 55px #000}' +
      '#twojet-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font-size:16px}' +
      '#twojet-close,.twojet-action{font:12px monospace;color:#ddd;background:#151515;border:1px solid #393939;border-radius:5px;padding:7px 10px;cursor:pointer}' +
      '#twojet-close:hover,.twojet-action:hover{background:#202020;border-color:#686868}' +
      '#twojet-warning{padding:10px 11px;margin:12px 0 15px;border:1px solid #55472a;border-radius:6px;background:#17130b;color:#d6c69e;font-size:11px}' +
      '.twojet-option{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid #262626}' +
      '.twojet-name{font-weight:bold}.twojet-url{margin-top:3px;color:#888;font-size:10px;overflow-wrap:anywhere}' +
      '.twojet-status{min-height:20px;margin-top:12px;color:#999;font-size:11px}' +
      '#twojet-auto{width:100%;margin:0 0 5px;padding:9px}' +
      '@media(max-width:700px){#twojet-open{font-size:10px;padding:4px 5px}.twojet-option{align-items:flex-start}.twojet-action{flex:0 0 auto}}';
    document.head.appendChild(style);

    var openButton = document.createElement('button');
    openButton.id = 'twojet-open';
    openButton.type = 'button';
    openButton.title = 'Choose or test a Wisp server';
    toolbar.insertBefore(openButton, document.getElementById('clearBtn'));

    var overlay = document.createElement('div');
    overlay.id = 'twojet-overlay';
    overlay.innerHTML =
      '<section id="twojet-dialog" role="dialog" aria-modal="true" aria-labelledby="twojet-title">' +
        '<div id="twojet-head"><strong id="twojet-title">Two-Jet connection</strong>' +
          '<button id="twojet-close" type="button" aria-label="Close">Close</button></div>' +
        '<div id="twojet-warning">Public Wisp servers are run by third parties and can see the sites and traffic you route through them. Password-, token-, and authorization-bearing requests are blocked when a public server is selected. Auto-pick tries the local server first, then the listed public servers.</div>' +
        '<button id="twojet-auto" class="twojet-action" type="button">Auto-pick first reachable server</button>' +
        '<div id="twojet-options"></div>' +
        '<div id="twojet-status" class="twojet-status" role="status"></div>' +
      '</section>';
    document.body.appendChild(overlay);

    var optionList = document.getElementById('twojet-options');
    var status = document.getElementById('twojet-status');
    var autoButton = document.getElementById('twojet-auto');
    var closeButton = document.getElementById('twojet-close');

    function refresh() {
      var current = api.current();
      openButton.textContent = 'WISP: ' + (current.isPublic ? current.name : 'Local');
      optionList.replaceChildren();
      api.servers.forEach(function (server) {
        var row = document.createElement('div');
        row.className = 'twojet-option';

        var details = document.createElement('div');
        var label = document.createElement('div');
        label.className = 'twojet-name';
        label.textContent = server.name + (server.id === current.id ? ' · active' : '');
        var address = document.createElement('div');
        address.className = 'twojet-url';
        address.textContent = server.isPublic ? server.url : current.url + ' (same origin)';
        details.append(label, address);

        var action = document.createElement('button');
        action.className = 'twojet-action';
        action.type = 'button';
        action.textContent = server.id === current.id ? 'Reconnect' : 'Test & use';
        action.addEventListener('click', function () {
          action.disabled = true;
          status.textContent = 'Testing ' + server.name + '…';
          api.use(server.id).then(function (result) {
            status.textContent = result.name + ' connected.';
            refresh();
          }).catch(function (error) {
            status.textContent = server.name + ' failed: ' + error.message;
          }).finally(function () {
            action.disabled = false;
          });
        });

        row.append(details, action);
        optionList.appendChild(row);
      });
    }

    function show() {
      refresh();
      status.textContent = '';
      overlay.classList.add('open');
      closeButton.focus();
    }

    function hide() {
      overlay.classList.remove('open');
      openButton.focus();
    }

    openButton.addEventListener('click', show);
    closeButton.addEventListener('click', hide);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) hide();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && overlay.classList.contains('open')) hide();
    });

    autoButton.addEventListener('click', function () {
      autoButton.disabled = true;
      status.textContent = 'Testing local and Two-Jet servers…';
      api.autoPick().then(function (result) {
        status.textContent = 'Connected to ' + result.name + '.';
        refresh();
      }).catch(function (error) {
        status.textContent = 'No server responded: ' + error.message;
      }).finally(function () {
        autoButton.disabled = false;
      });
    });

    refresh();
  });
})();