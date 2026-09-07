#!/usr/bin/env node
// Encodes one invariant from CLAUDE.md's rule #10 ("fix the rule, not the
// instance"): every write to `commitments` must go through an RPC in
// src/features/commitments/api.ts. This script fails the build if a
// direct .insert(/.update(/.delete(/.upsert( call on the table shows up
// anywhere else in src/ — the migration's grants make that call fail at
// runtime anyway, this just catches it before a PR.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const ALLOWED_FILE = join(SRC, "features", "commitments", "api.ts");
const WRITE_CALL = /\.(insert|update|delete|upsert)\s*\(/;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

const violations = [];

for (const file of walk(SRC)) {
  if (file === ALLOWED_FILE) continue;
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    if (WRITE_CALL.test(line)) {
      violations.push(`${relative(ROOT, file)}:${index + 1}  ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error("Write-boundary violation — direct table writes belong only in");
  console.error(`  ${relative(ROOT, ALLOWED_FILE)}\n`);
  for (const v of violations) console.error(`  ${v}`);
  console.error("\nAdd an RPC in the migration and call it from api.ts instead.");
  process.exit(1);
}

console.log("check:boundaries — ok, no direct table writes outside api.ts");
