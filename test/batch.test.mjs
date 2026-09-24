import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBatch, buildOne, chunk, splitBatch, zipBatch } from "../src/batch.mjs";

test("a single call is shaped per the spec", () => {
  assert.deepEqual(buildOne("eth_blockNumber"), {
    jsonrpc: "2.0", method: "eth_blockNumber", params: [],
  });
});

test("batch ids default to 1-based positions", () => {
  const b = buildBatch([{ method: "a" }, { method: "b" }]);
  assert.deepEqual(b.map((c) => c.id), [1, 2]);
});

test("explicit ids are kept", () => {
  const b = buildBatch([{ method: "a", id: "x" }, { method: "b", id: "y" }]);
  assert.deepEqual(b.map((c) => c.id), ["x", "y"]);
});

test("duplicate ids are rejected at build time", () => {
  assert.throws(() => buildBatch([{ method: "a", id: 1 }, { method: "b", id: 1 }]), /duplicate id/);
});

test("an empty batch is rejected", () => {
  assert.throws(() => buildBatch([]), /at least one call/);
});

test("responses are paired by id, not by position", () => {
  const calls = [{ method: "a", id: 1 }, { method: "b", id: 2 }, { method: "c", id: 3 }];
  // the node answers out of order, which is allowed
  const payload = [
    { jsonrpc: "2.0", id: 3, result: "third" },
    { jsonrpc: "2.0", id: 1, result: "first" },
    { jsonrpc: "2.0", id: 2, result: "second" },
  ];
  const { results } = zipBatch(calls, payload);
  assert.deepEqual(results.map((r) => r.result), ["first", "second", "third"]);
});

test("errors are surfaced per call", () => {
  const { results } = zipBatch([{ method: "a", id: 1 }],
    [{ jsonrpc: "2.0", id: 1, error: { code: -32000, message: "boom" } }]);
  assert.equal(results[0].ok, false);
  assert.equal(results[0].error.code, -32000);
});

test("missing and unexpected ids are reported", () => {
  const { missing, unexpected } = zipBatch(
    [{ method: "a", id: 1 }, { method: "b", id: 2 }],
    [{ jsonrpc: "2.0", id: 2, result: 1 }, { jsonrpc: "2.0", id: 99, result: 2 }],
  );
  assert.deepEqual(missing, [1]);
  assert.deepEqual(unexpected, [99]);
});

test("a missing call is marked not-ok rather than left undefined", () => {
  const { results } = zipBatch([{ method: "a", id: 7 }], []);
  assert.equal(results[0].ok, false);
  assert.match(results[0].error.message, /missing/);
});

test("null entries in a response are tolerated", () => {
  const m = splitBatch([null, { jsonrpc: "2.0", id: 1, result: "ok" }]);
  assert.equal(m.size, 1);
});

test("a non-array response is rejected", () => {
  assert.throws(() => splitBatch({ id: 1 }), /must be an array/);
});

test("chunk splits into contiguous groups", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.throws(() => chunk([1], 0), /positive integer/);
});
