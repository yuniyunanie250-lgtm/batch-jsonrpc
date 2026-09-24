/**
 * Build and split JSON-RPC batch requests.
 *
 * Batching several calls into one HTTP request is the standard way to cut
 * round-trips when reading chain state, and it is where a lot of indexers get
 * subtly wrong results: JSON-RPC does NOT guarantee the response order matches
 * the request order. Responses carry an `id`, and anything that pairs them by
 * position will silently mislabel data under load.
 *
 * This module keeps ids explicit and matches responses back by id.
 */

export function buildOne(method, params = []) {
  if (typeof method !== "string" || method.length === 0) throw new Error("method must be a string");
  if (!Array.isArray(params)) throw new Error("params must be an array");
  return { jsonrpc: "2.0", method, params };
}

/**
 * Build a batch. Each entry gets a caller-supplied label which becomes the id,
 * so a response can be traced back to the call that produced it.
 * @param {{method: string, params?: unknown[], id?: number|string}[]} calls
 */
export function buildBatch(calls) {
  if (!Array.isArray(calls) || calls.length === 0) {
    throw new Error("a batch needs at least one call");
  }
  const seen = new Set();
  return calls.map((c, i) => {
    const id = c.id ?? i + 1;
    if (seen.has(id)) throw new Error(`duplicate id in batch: ${id}`);
    seen.add(id);
    return { ...buildOne(c.method, c.params ?? []), id };
  });
}

/**
 * Split a batch response back into results keyed by id.
 * @returns {Map<number|string, {ok: boolean, result?: unknown, error?: object}>}
 */
export function splitBatch(payload) {
  if (!Array.isArray(payload)) throw new Error("a batch response must be an array");
  const out = new Map();
  for (const entry of payload) {
    if (entry === null || typeof entry !== "object") continue; // spec allows nulls
    if (entry.id === undefined || entry.id === null) continue;
    if (out.has(entry.id)) throw new Error(`duplicate id in response: ${entry.id}`);
    out.set(entry.id, entry.error
      ? { ok: false, error: entry.error }
      : { ok: true, result: entry.result });
  }
  return out;
}

/**
 * Pair a batch with its response and report anything that did not come back.
 * This is the function to use instead of zipping arrays together.
 */
export function zipBatch(calls, payload) {
  const sent = buildBatch(calls);
  const got = splitBatch(payload);
  const results = sent.map((c) => ({ id: c.id, method: c.method, ...(got.get(c.id) ?? { ok: false, error: { message: "missing from response" } }) }));
  return {
    results,
    missing: sent.filter((c) => !got.has(c.id)).map((c) => c.id),
    unexpected: [...got.keys()].filter((id) => !sent.some((c) => c.id === id)),
  };
}

/** Chunk a list of calls into batches of at most `size`. */
export function chunk(calls, size) {
  if (!Number.isInteger(size) || size < 1) throw new Error("chunk size must be a positive integer");
  const out = [];
  for (let i = 0; i < calls.length; i += size) out.push(calls.slice(i, i + size));
  return out;
}
