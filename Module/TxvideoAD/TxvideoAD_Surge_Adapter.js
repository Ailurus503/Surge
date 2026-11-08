/*
 * Surge compatibility adapter for ZenMoFiShi/Qx/Txvideoad.js.
 * The upstream script uses Quantumult X's `bodyBytes` API.
 * Surge passes Uint8Array via `body` in binary-body-mode, so this
 * adapter translates input and output without changing upstream logic.
 *
 * Upstream author: TG@ZenMoFiShi
 * This adapter downloads the upstream script when first used and
 * refreshes its cached copy at most once per 24 hours.
 */
(() => {
  "use strict";

  const SOURCE_URL = "https://raw.githubusercontent.com/ZenmoFeiShi/Qx/refs/heads/main/Txvideoad.js";
  const CODE_KEY = "txvideo_surge_upstream_code_v1";
  const TIME_KEY = "txvideo_surge_upstream_time_v1";
  const TTL_MS = 24 * 60 * 60 * 1000;
  const realRequest = $request;
  const realResponse = typeof $response === "undefined" ? undefined : $response;
  const realDone = $done;
  let completed = false;

  function finish(value) {
    if (completed) return;
    completed = true;
    realDone(value || {});
  }

  function utf8Encode(s) {
    const encoded = encodeURIComponent(s);
    const bytes = [];
    for (let i = 0; i < encoded.length; i++) {
      if (encoded[i] === "%") {
        bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(encoded.charCodeAt(i));
      }
    }
    return new Uint8Array(bytes);
  }

  function utf8Decode(bytes) {
    if (typeof bytes === "string") return bytes;
    if (!(bytes instanceof Uint8Array)) return "";
    let str = "";
    for (let i = 0; i < bytes.length; i++) {
      str += "%" + bytes[i].toString(16).padStart(2, "0");
    }
    try { return decodeURIComponent(str); }
    catch (_) { return ""; }
  }

  function compatibleDone(out) {
    if (!out || typeof out !== "object") return finish({});
    if (out.bodyBytes !== undefined && out.bodyBytes !== null) {
      const data = out.bodyBytes;
      let body;
      if (data instanceof Uint8Array) {
        body = data;
      } else if (data instanceof ArrayBuffer) {
        body = new Uint8Array(data);
      } else if (ArrayBuffer.isView(data)) {
        body = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      } else {
        return finish({});
      }
      return finish({ body });
    }
    if (typeof out.body === "string") {
      return finish({ body: utf8Encode(out.body) });
    }
    return finish({});
  }

  function runUpstream(source) {
    try {
      if (typeof source !== "string" || !source.includes("function main()")) {
        throw new Error("Upstream script invalid");
      }
      const $request = Object.assign({}, realRequest, {
        bodyBytes: realRequest.body
      });
      const $response = realResponse ? Object.assign({}, realResponse, {
        bodyBytes: realResponse.body,
        body: /^(?:https?:\/\/)?rdelivery\.qq\.com\//.test(realRequest.url) ? utf8Decode(realResponse.body) : ""
      }) : undefined;
      const $done = compatibleDone;
      eval(source);
    } catch (error) {
      console.log("TxVideo Surge adapter: " + error);
      finish({});
    }
  }

  const cached = $persistentStore.read(CODE_KEY);
  const storedAt = Number($persistentStore.read(TIME_KEY) || 0);
  if (cached && Date.now() - storedAt < TTL_MS) {
    runUpstream(cached);
    return;
  }

  $httpClient.get({ url: SOURCE_URL, timeout: 8 }, (error, response, data) => {
    if (!error && response && response.status === 200 &&
        typeof data === "string" && data.includes("function main()")) {
      $persistentStore.write(data, CODE_KEY);
      $persistentStore.write(String(Date.now()), TIME_KEY);
      runUpstream(data);
    } else if (cached) {
      console.log("TxVideo Surge adapter: source update failed; using cached copy.");
      runUpstream(cached);
    } else {
      console.log("TxVideo Surge adapter: cannot load original script: " + (error || (response && response.status)));
      finish({});
    }
  });
})();
