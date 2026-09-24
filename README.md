# batch-jsonrpc

Build JSON-RPC batch requests and pair responses back to their calls **by id**.

Batching is the standard way to cut round-trips when reading chain state. The
trap is that JSON-RPC does not require responses to come back in request order.
An indexer that zips the two arrays together gets plausible-looking but wrong
data whenever a node batches out of order, and it does so under load, which is
the worst possible time to discover it.

## Usage

```bash
npx github:yuniyunanie250-lgtm/batch-jsonrpc build eth_blockNumber eth_chainId
```

```json
[{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1},
 {"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":2}]
```

```js
import { zipBatch, chunk } from "batch-jsonrpc";

const { results, missing, unexpected } = zipBatch(calls, await rpc(payload));
results[0].method;  // 'eth_blockNumber' — always paired correctly
missing;            // ids the node did not answer
unexpected;         // ids you never asked for
```

## Rules it enforces

- **Match by id, never by index.** `zipBatch` is the entry point for a reason.
- **Duplicate ids are rejected** when building and when splitting. A duplicate id
  makes a response ambiguous, and guessing which call it belongs to is worse than
  failing.
- **A call with no response is marked not-ok** with a "missing from response"
  error, rather than being returned as `undefined` for the caller to trip over.
- **`null` entries are tolerated.** The spec allows them for calls the node
  could not parse.

## What it does not do

- **No transport.** It shapes and unpairs requests; you do the HTTP.
- **No retry.** Retrying a failed call in a batch is a policy decision — some
  errors are retryable, parameter errors are not.
- **No concurrency control.** `chunk` gives you groups to send; how many in
  flight is yours to decide.

## Development

```bash
npm test
```

## License
