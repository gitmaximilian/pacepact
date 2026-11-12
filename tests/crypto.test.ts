import assert from "node:assert/strict";
import { test } from "node:test";
import { inviteCode, randomToken, sha256 } from "../src/lib/crypto.ts";

test("invite codes avoid look-alike characters", () => {
  for (let i = 0; i < 50; i++) assert.match(inviteCode(), /^[A-HJ-NP-Z2-9]{6}$/);
});

test("tokens are random and hashes stable", () => {
  assert.notEqual(randomToken(), randomToken());
  assert.equal(sha256("a"), "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb");
});
