import assert from "node:assert/strict";
import { test } from "node:test";
import { listSize } from "../src/lib/paging.ts";

test("list size: page steps, capped, robust against junk", () => {
  assert.equal(listSize(null, 30, 300), 30);
  assert.equal(listSize("abc", 30, 300), 30);
  assert.equal(listSize("-5", 30, 300), 30);
  assert.equal(listSize("60", 30, 300), 60);
  assert.equal(listSize("61", 30, 300), 90);
  assert.equal(listSize("100000", 30, 300), 300);
});
