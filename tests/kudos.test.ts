import assert from "node:assert/strict";
import { test } from "node:test";
import { kudoState, toggleKudo } from "../src/lib/social/kudos.ts";

test("kudos: state from reactions, toggling on and off", () => {
  const s = kudoState(["clap", "fire"], [{ emoji: "clap", userId: "a" }, { emoji: "clap", userId: "me" }], "me");
  assert.deepEqual(s, { clap: { n: 2, mine: true }, fire: { n: 0, mine: false } });
  const off = toggleKudo(s, "clap");
  assert.deepEqual(off.clap, { n: 1, mine: false });
  const on = toggleKudo(off, "fire");
  assert.deepEqual(on.fire, { n: 1, mine: true });
  assert.deepEqual(toggleKudo(on, "fire").fire, { n: 0, mine: false });
});
