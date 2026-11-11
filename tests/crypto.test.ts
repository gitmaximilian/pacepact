import assert from "node:assert/strict";
import { test } from "node:test";
import { decrypt, encrypt, hashPassword, inviteCode, verifyPassword } from "../src/lib/crypto.ts";

test("password hashing round-trip", async () => {
  const h = await hashPassword("correct horse battery");
  assert.ok(await verifyPassword("correct horse battery", h));
  assert.ok(!(await verifyPassword("wrong password!", h)));
});

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
