import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { updateAuthSession } from "./supabase-middleware";

test("updateAuthSession awaits auth refresh and applies cookie mutations to the response", async () => {
  let refreshed = false;

  const response = await updateAuthSession(
    new NextRequest("https://example.com/account"),
    "https://example.supabase.co",
    "anon-key",
    ((_url: string, _key: string, options: { cookies: { setAll: (cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => void } }) => ({
      auth: {
        async getUser() {
          await new Promise((resolve) => setTimeout(resolve, 0));
          options.cookies.setAll([{ name: "sb-test-auth", value: "refreshed", options: { path: "/" } }]);
          refreshed = true;
          return { data: { user: null }, error: null };
        },
      },
    })) as never,
  );

  assert.equal(refreshed, true);
  assert.equal(response.cookies.get("sb-test-auth")?.value, "refreshed");
});
