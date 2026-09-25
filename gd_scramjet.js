(function () {
  var clientPromise = null;
  var wispServers = [
    { id: 'local', name: 'Local Wisp', url: null, isPublic: false },
    { id: 'onyx', name: 'Onyx WISP', url: 'wss://onyxv1.ai.studio/', isPublic: true },
    { id: 'english-revision', name: 'English Revision', url: 'wss://wisp.englishrevision.site/', isPublic: true },
    { id: 'html-project', name: 'HTML Project', url: 'wss://wisp3.thehtmlproject.com/', isPublic: true }
  ];
  var selectedServerId = 'local';

  try {
    var savedServerId = localStorage.getItem('gdTwoJetWisp');
    if (savedServerId && wispServers.some(function (server) { return server.id === savedServerId; })) {
      selectedServerId = savedServerId;
    }
  } catch (e) {}

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function localWispUrl() {
    try {
      if (window.TruffledTransport) return window.TruffledTransport.getWisp();
    } catch (e) {}
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + location.host + '/wisp/';
  }

  function selectedServer() {
    return wispServers.filter(function (server) {
      return server.id === selectedServerId;
    })[0] || wispServers[0];
  }

  function selectedWispUrl() {
    var server = selectedServer();
    return server.isPublic ? server.url : localWispUrl();
  }

  async function createClient(url) {
    if (!window.TruffledTransport) {
      try { await loadScript('/js/transport.js'); } catch (e) {}
    }
    var mod = await import('/js/libcurlbareclient.mjs');
    var c = new mod.default({ wisp: url });
    await withTimeout(c.init(), 15000, 'Wisp connection');
    return c;
  }

  function client() {
    if (!clientPromise) {
      clientPromise = createClient(selectedWispUrl());
      clientPromise.catch(function () { clientPromise = null; });
    }
    return clientPromise;
  }

  function headerObject(h) {
    var out = {};
    if (h) {
      if (typeof Headers !== 'undefined' && h instanceof Headers) {
        h.forEach(function (v, k) { out[k] = v; });
      } else if (Array.isArray(h)) {
        for (var i = 0; i < h.length; ++i) out[h[i][0]] = h[i][1];
      } else {
        for (var k in h) out[k] = h[k];
      }
    }
    out['User-Agent'] = ' ';
    if (!out.Accept && !out.accept) out.Accept = '*/*';
    return out;
  }

  function pairsOf(p) {
    if (Array.isArray(p.raw_headers)) return p.raw_headers;
    var out = [];
    if (p.headers && p.headers.forEach) {
      p.headers.forEach(function (v, k) { out.push([k, v]); });
    }
    return out;
  }

  function responseHeaders(pairs) {
    var headers = new Headers();
    (pairs || []).forEach(function (p) {
      try { headers.append(p[0], p[1]); } catch (e) {}
    });
    if (headers.has('content-encoding')) {
      headers.delete('content-encoding');
      headers.delete('content-length');
    }
    return headers;
  }

  function withTimeout(promise, ms, label) {
    var timer;
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        timer = setTimeout(function () {
          reject(new TypeError(label + ' timed out'));
        }, ms);
      })
    ]).finally(function () { clearTimeout(timer); });
  }

  function credentialRequest(init) {
    init = init || {};
    var headers = init.headers;
    if (headers) {
      if (typeof Headers !== 'undefined' && headers instanceof Headers) {
        if (headers.has('authorization')) return true;
      } else if (Array.isArray(headers)) {
        for (var i = 0; i < headers.length; ++i) {
          if (String(headers[i][0]).toLowerCase() === 'authorization') return true;
        }
      } else {
        for (var name in headers) {
          if (String(name).toLowerCase() === 'authorization') return true;
        }
      }
    }
    var body = init.body;
    if (!body) return false;
    var text = '';
    try {
      if (typeof body === 'string' || body instanceof URLSearchParams) {
        text = String(body);
      } else if (typeof FormData !== 'undefined' && body instanceof FormData) {
        body.forEach(function (_, key) { text += key + '='; });
      } else if (body instanceof ArrayBuffer) {
        text = new TextDecoder().decode(body);
      } else if (ArrayBuffer.isView(body)) {
        text = new TextDecoder().decode(body);
      }
    } catch (e) {}
    return /(?:^|[&{,\s"])(?:gjp2?|password|token|authorization|secret)\s*(?:=|:)/i.test(text);
  }

  function storeSelection(server) {
    selectedServerId = server.id;
    try { localStorage.setItem('gdTwoJetWisp', server.id); } catch (e) {}
    var oldClientPromise = clientPromise;
    clientPromise = null;
    if (oldClientPromise) {
      oldClientPromise.then(function (oldClient) {
        try { if (oldClient && oldClient.resetSession) oldClient.resetSession(); } catch (e) {}
      }).catch(function () {});
    }
  }

  window.__gdTwoJetWisp = {
    servers: wispServers.map(function (server) {
      return { id: server.id, name: server.name, url: server.url, isPublic: server.isPublic };
    }),
    current: function () {
      var server = selectedServer();
      return { id: server.id, name: server.name, url: selectedWispUrl(), isPublic: server.isPublic };
    },
    use: async function (id) {
      var server = wispServers.filter(function (candidate) { return candidate.id === id; })[0];
      if (!server) throw new TypeError('Unknown Wisp server');
      var previousServer = selectedServer();
      storeSelection(server);
      clientPromise = createClient(selectedWispUrl());
      try {
        var connected = await clientPromise;
        return { id: server.id, name: server.name, url: selectedWispUrl(), isPublic: server.isPublic, connected: !!connected };
      } catch (error) {
        storeSelection(previousServer);
        throw error;
      }
    },
    autoPick: async function () {
      var lastError;
      for (var i = 0; i < wispServers.length; ++i) {
        var server = wispServers[i];
        try {
          var connected = await createClient(server.isPublic ? server.url : localWispUrl());
          storeSelection(server);
          clientPromise = Promise.resolve(connected);
          return { id: server.id, name: server.name, url: selectedWispUrl(), isPublic: server.isPublic, connected: true };
        } catch (e) {
          lastError = e;
        }
      }
      throw lastError || new TypeError('No Wisp servers are reachable');
    }
  };

  async function once(c, url, opts) {
    try {
      return await withTimeout(c.session.fetch(url.href, opts), 20000,
                               'request');
    } catch (e) {
      if (opts.signal && opts.signal.aborted) throw e;
      if (opts.method !== 'GET' && opts.method !== 'HEAD') throw e;
      c.resetSession();
      return await withTimeout(c.session.fetch(url.href, opts), 20000,
                               'retry');
    }
  }

  window.__gdScramjetFetch = async function (target, init) {
    init = init || {};
    if (selectedServer().isPublic && credentialRequest(init)) {
      throw new TypeError('Credential-bearing requests are blocked on public Wisp servers');
    }
    var c = await withTimeout(client(), 15000, 'transport start');
    var method = String(init.method || 'GET').toUpperCase();
    var body = init.body;
    var headers = headerObject(init.headers);
    var url = new URL(target);
    for (var hop = 0; hop < 6; ++hop) {
      var p = await once(c, url, {
        method: method,
        headers: headers,
        body: body,
        redirect: 'manual',
        signal: init.signal
      });
      var pairs = pairsOf(p);
      if (p.status === 403 || p.status === 429 || p.status === 503)
        throw new TypeError('upstream refused the transport (' + p.status + ')');
      if (p.status >= 300 && p.status < 400) {
        var loc = null;
        pairs.forEach(function (q) {
          if (String(q[0]).toLowerCase() === 'location') loc = q[1];
        });
        if (loc) {
          url = new URL(loc, url);
          if (p.status !== 307 && p.status !== 308) {
            method = 'GET';
            body = undefined;
            delete headers['Content-Type'];
            delete headers['content-type'];
          }
          continue;
        }
      }
      var empty = p.status === 204 || p.status === 304 || method === 'HEAD';
      return new Response(empty ? null : p.body, {
        status: p.status,
        statusText: p.statusText || '',
        headers: responseHeaders(pairs)
      });
    }
    throw new TypeError('too many redirects');
  };
})();
