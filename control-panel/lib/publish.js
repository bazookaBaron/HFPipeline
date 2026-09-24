"use strict";

/**
 * Publish endpoints -- STUBBED ON PURPOSE. Real OAuth + platform upload APIs
 * are Phase 7. Every function here returns a 501-shaped error object; none
 * of them write anywhere, touch a network API, or report fake success. The
 * UI is expected to surface this message verbatim rather than pretending the
 * publish happened.
 */

function notImplemented(platform) {
  const err = new Error(
    `Publishing to ${platform} is not implemented yet (Phase 7). This endpoint is a clearly-marked stub -- ` +
      `no video/image was uploaded anywhere.`
  );
  err.statusCode = 501;
  return err;
}

function publishYoutube(_runId, _reviewPayload) {
  throw notImplemented("YouTube");
}

function publishInstagram(_runId, _reviewPayload) {
  throw notImplemented("Instagram");
}

module.exports = { publishYoutube, publishInstagram };
