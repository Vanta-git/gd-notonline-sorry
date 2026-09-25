(function () {
  'use strict';

  var CHUNK_BYTES = 3000000;
  var BATCH_SIZE = 4;
  var specs = {
    wasm: { name: 'gd_web.wasm', size: 69828965, parts: 24 },
    data: { name: 'gd_web.data', size: 314500859, parts: 105 }
  };

  function findAsset(input) {
    var raw = typeof input === 'string' ? input : (input && input.url) || '';
    if (!raw) return null;
    var url;
    try { url = new URL(raw, location.href); } catch (e) { return null; }
    var match = /(?:^|\/)(gd_web\.(wasm|data))$/.exec(url.pathname);
    if (!match) return null;
    return { url: url, spec: specs[match[2]] };
  }

  function partName(spec, index) {
    return spec.name + '.part' + String(index).padStart(3, '0');
  }

  function expectedPartSize(spec, index) {
    return Math.min(CHUNK_BYTES, spec.size - index * CHUNK_BYTES);
  }

  function fetchPart(baseFetch, assetUrl, init, spec, index) {
    var url = new URL(partName(spec, index), assetUrl);
    return baseFetch(url.href, {
      cache: 'no-store',
      credentials: init.credentials || 'same-origin',
      signal: init.signal
    }).then(function (response) {
      if (!response.ok) {
        throw new Error(spec.name + ' part ' + index + ' returned HTTP ' + response.status);
      }
      return response.arrayBuffer();
    }).then(function (buffer) {
      var expected = expectedPartSize(spec, index);
      if (buffer.byteLength !== expected) {
        throw new Error(spec.name + ' part ' + index + ' has ' +
          buffer.byteLength + ' bytes; expected ' + expected);
      }
      return new Uint8Array(buffer);
    });
  }

  function bufferedResponse(baseFetch, assetUrl, init, spec) {
    var result = new Uint8Array(spec.size);
    var offset = 0;
    var next = 0;

    function fetchBatch() {
      if (next >= spec.parts) {
        return Promise.resolve(new Response(result, {
          status: 200,
          headers: {
            'Content-Length': String(spec.size),
            'Content-Type': spec.name.indexOf('.wasm') >= 0
              ? 'application/wasm' : 'application/octet-stream'
          }
        }));
      }
      var start = next;
      var end = Math.min(spec.parts, start + BATCH_SIZE);
      next = end;
      var jobs = [];
      for (var i = start; i < end; ++i) jobs.push(fetchPart(baseFetch, assetUrl, init, spec, i));
      return Promise.all(jobs).then(function (parts) {
        parts.forEach(function (part) {
          result.set(part, offset);
          offset += part.byteLength;
        });
        return fetchBatch();
      });
    }

    return fetchBatch();
  }

  window.__gdChunkedResponse = function (baseFetch, input, init) {
    init = init || {};
    var method = String(init.method ||
      (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase();
    var asset = findAsset(input);
    if (!asset || method !== 'GET') return baseFetch(input, init);

    var spec = asset.spec;
    var loaded = 0;
    var headers = {
      'Content-Length': String(spec.size),
      'Content-Type': spec.name.indexOf('.wasm') >= 0
        ? 'application/wasm' : 'application/octet-stream'
    };

    if (typeof ReadableStream === 'undefined') {
      return bufferedResponse(baseFetch, asset.url, init, spec);
    }

    var stream = new ReadableStream({
      pull: function (controller) {
        if (this.busy) return;
        if (this.next >= spec.parts) {
          controller.close();
          return;
        }

        this.busy = true;
        var start = this.next;
        var end = Math.min(spec.parts, start + BATCH_SIZE);
        var jobs = [];
        for (var i = start; i < end; ++i) jobs.push(fetchPart(baseFetch, asset.url, init, spec, i));

        var streamState = this;
        return Promise.all(jobs).then(function (parts) {
          parts.forEach(function (part) {
            controller.enqueue(part);
            loaded += part.byteLength;
            streamState.next += 1;
            if (window.__gdChunkProgress) {
              window.__gdChunkProgress[spec.name] = loaded;
            }
          });
          if (streamState.next >= spec.parts) controller.close();
        }).catch(function (error) {
          controller.error(error);
        }).finally(function () {
          streamState.busy = false;
        });
      },
      start: function () {
        this.next = 0;
        this.busy = false;
      }
    });

    return Promise.resolve(new Response(stream, { status: 200, headers: headers }));
  };

  window.__gdChunkProgress = {};
})();