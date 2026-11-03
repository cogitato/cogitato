// Makes staged versions public (ADR 016). CI only stages; a maintainer approves here, with 2FA.
//
//   pnpm release:approve              lists what's staged, then approves one version after a yes
//   pnpm release:approve <version>    picks that version when more than one is staged
//   pnpm release:approve --list       only lists
//   pnpm release:approve --reject     throws a staged version away instead (it never goes public)
//
// Packages are approved dependencies first, so nobody can install one whose dependencies aren't
// public yet. npm asks for the one-time password itself.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const ORDER = ["@cogitato/contract", "@cogitato/canvas", "@cogitato/kit-cli", "@cogitato/runtime", "@cogitato/kit-mcp", "create-cogitato"];
const [fixed] = JSON.parse(readFileSync(new URL("../.changeset/config.json", import.meta.url), "utf8")).fixed;
if (ORDER.length !== fixed.length || !fixed.every((n) => ORDER.includes(n))) {
  console.error("The package list here doesn't match the fixed group in .changeset/config.json. Update ORDER first.");
  process.exit(1);
}

const shell = process.platform === "win32";
const pnpm = (args, opts = {}) => spawnSync("pnpm", args, { encoding: "utf8", shell, ...opts });

const staged = ORDER.flatMap((name) => {
  const r = pnpm(["stage", "list", name, "--json"]);
  if (r.status !== 0) {
    console.error(`Couldn't list staged versions of ${name}. Are you logged in to npm (npm login)?\n${r.stderr}`);
    process.exit(1);
  }
  return JSON.parse(r.stdout || "[]");
});

const args = process.argv.slice(2);
const reject = args.includes("--reject");
const versions = [...new Set(staged.map((s) => s.version))];
if (!staged.length) {
  console.log("Nothing is staged.");
  process.exit(0);
}
for (const s of staged) console.log(`${s.packageName}@${s.version}  tag ${s.tag}  (${s.status}, from ${s.actor} at ${s.createdAt})`);
if (args.includes("--list")) process.exit(0);

const version = args.find((a) => !a.startsWith("--")) ?? (versions.length === 1 ? versions[0] : undefined);
if (!version) {
  console.error(`\nMore than one version is staged. Say which: pnpm release:approve <version>\n  ${versions.join("\n  ")}`);
  process.exit(1);
}
const picked = ORDER.map((name) => staged.find((s) => s.packageName === name && s.version === version)).filter(Boolean);
const missing = ORDER.filter((name) => !picked.some((s) => s.packageName === name));
if (missing.length && !reject) {
  console.error(`\n${version} isn't staged for ${missing.join(", ")}. All six go out together, so nothing was approved.`);
  process.exit(1);
}
// npm checks each upload for a minute or so after staging ("validating") before it can be approved.
const notReady = reject ? [] : picked.filter((s) => s.status !== "staged");
if (notReady.length) {
  console.error(`\nnpm is still checking ${notReady.map((s) => s.packageName).join(", ")}. Try again in a minute.`);
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const question = reject
  ? `\nThrow away staged ${version} for ${picked.length} packages? It won't go public. [y/N] `
  : `\nMake ${version} public for all ${picked.length} packages (tag "${picked[0].tag}")? This can't be undone. [y/N] `;
const answer = await rl.question(question);
rl.close();
if (answer.trim().toLowerCase() !== "y") {
  console.log(`Nothing was ${reject ? "rejected" : "approved"}.`);
  process.exit(0);
}
const verb = reject ? "reject" : "approve";
for (const s of picked) {
  console.log(`\n${reject ? "Rejecting" : "Approving"} ${s.packageName}@${s.version}...`);
  if (pnpm(["stage", verb, s.id], { stdio: "inherit" }).status !== 0) {
    console.error(`That failed for ${s.packageName}, so the rest were left alone. Fix it and run this again: it picks up where it stopped.`);
    process.exit(1);
  }
}
console.log(reject ? `\n${version} was thrown away.` : `\n${version} is public.`);
