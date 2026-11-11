import assert from "node:assert/strict";
import { test } from "node:test";
import { decrypt, encrypt, inviteCode } from "../src/lib/crypto.ts";

test("token encryption round-trip and tamper detection", () => {
  const c = encrypt("secret-access-token");
  assert.equal(decrypt(c), "secret-access-token");
  const parts = c.split(".");
  parts[3] = Buffer.from("tampered").toString("base64url");
  assert.throws(() => decrypt(parts.join(".")));
});

test("invite codes avoid look-alike characters", () => {
  for (let i = 0; i < 50; i++) assert.match(inviteCode(), /^[A-HJ-NP-Z2-9]{6}$/);
});
