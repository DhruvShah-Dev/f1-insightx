import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapAuthErrorCode, mapProviderCallbackError, sanitizeInternalRedirectPath } from "@/lib/auth/navigation";

describe("auth navigation safety", () => {
  it("maps provider callback failures to safe account messages", () => {
    assert.equal(mapProviderCallbackError("access_denied", "User cancelled"), "oauth-access-denied");
    assert.equal(mapProviderCallbackError("server_error", "Provider is not enabled"), "google-provider-unavailable");
    assert.equal(mapProviderCallbackError("server_error", "Unexpected callback failure"), "oauth-callback-error");

    assert.equal(
      mapAuthErrorCode("google-provider-unavailable"),
      "Google sign-in is currently unavailable. Use email sign-in or try again later.",
    );
    assert.equal(mapAuthErrorCode("oauth-access-denied"), "Google sign-in was cancelled. Email sign-in is still available.");
    assert.equal(mapAuthErrorCode("missing-auth-code"), "The sign-in request could not be completed. Try again.");
  });

  it("keeps callback redirects internal", () => {
    assert.equal(sanitizeInternalRedirectPath("/account"), "/account");
    assert.equal(sanitizeInternalRedirectPath("https://example.com"), "/account");
    assert.equal(sanitizeInternalRedirectPath("//example.com"), "/account");
  });
});
