#!/usr/bin/env node
import { buildBatch, chunk, zipBatch } from "./batch.mjs";

const HELP = `batch -- build and split JSON-RPC batches

usage:
  batch build <method> [<method> ...]
  batch chunk <size> <method> [<method> ...]
  batch --help

example:
  batch build eth_blockNumber eth_chainId eth_gasPrice
`;

function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === "-h" || cmd === "--help") return void process.stdout.write(HELP);
  if (cmd === "build") {
    if (rest.length === 0) throw new Error("build needs at least one method");
    console.log(JSON.stringify(buildBatch(rest.map((m) => ({ method: m })))));
    return;
  }
  if (cmd === "chunk") {
    const size = Number(rest.shift());
    const batches = chunk(rest.map((m) => ({ method: m })), size);
    console.log(JSON.stringify(batches));
    return;
  }
  throw new Error(`unknown command: ${cmd}`);
}

try {
  main(process.argv.slice(2));
} catch (err) {
  console.error(`batch: ${err.message}`);
  process.exit(1);
}
