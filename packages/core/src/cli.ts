#!/usr/bin/env node

import { AiTxtClient } from "./client.js";
import { generate } from "./generator.js";
import { resolve } from "./resolver.js";
import type { AiTxtDocument, PolicyValue } from "./types.js";

const args = process.argv.slice(2);
const command = args[0];

function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : undefined;
}

async function check(url: string) {
  const agent = flag("agent") ?? "ai-txt-cli/0.1";
  const client = new AiTxtClient({ userAgent: agent });
  const result = await client.discover(url);

  if (!result.success) {
    console.log(`No ai.txt found at ${url}`);
    console.log("This site has not declared an AI policy via ai.txt.");
    process.exit(1);
  }

  const doc = result.document!;
  console.log(`\n  ${doc.site.name} (${doc.site.url})\n`);

  console.log("  Policies:");
  console.log(`    Training:  ${doc.policies.training}`);
  console.log(`    Scraping:  ${doc.policies.scraping}`);
  console.log(`    Indexing:  ${doc.policies.indexing}`);
  console.log(`    Caching:   ${doc.policies.caching}`);

  if (doc.licensing?.license) {
    console.log(`\n  License: ${doc.licensing.license}`);
  }

  if (doc.content?.attribution) {
    console.log(`  Attribution: ${doc.content.attribution}`);
  }

  const agentNames = Object.keys(doc.agents).filter((a) => a !== "*");
  if (agentNames.length > 0) {
    console.log(`\n  Agent-specific rules: ${agentNames.join(", ")}`);
  }

  // If an agent name was provided, show resolved policy
  if (flag("agent")) {
    const resolved = resolve(doc, agent);
    console.log(`\n  Resolved policy for "${agent}":`);
    console.log(`    Training:  ${resolved.training}`);
    console.log(`    Scraping:  ${resolved.scraping}`);
    console.log(`    Indexing:  ${resolved.indexing}`);
    console.log(`    Caching:   ${resolved.caching}`);
    if (resolved.rateLimit) {
      console.log(`    Rate limit: ${resolved.rateLimit.requests}/${resolved.rateLimit.window}`);
    }
  }

  console.log();
}

const VALID_POLICY_VALUES = new Set<string>(["allow", "deny", "conditional"]);

function parsePolicyFlag(name: string, defaultValue: PolicyValue): PolicyValue {
  const value = flag(name);
  if (!value) return defaultValue;
  if (!VALID_POLICY_VALUES.has(value)) {
    console.error(`Error: Invalid value "${value}" for --${name}. Must be one of: allow, deny, conditional`);
    process.exit(1);
  }
  return value as PolicyValue;
}

function gen() {
  const name = flag("name");
  const url = flag("url");
  const training = parsePolicyFlag("training", "deny");
  const scraping = parsePolicyFlag("scraping", "allow");
  const indexing = parsePolicyFlag("indexing", "allow");
  const caching = parsePolicyFlag("caching", "allow");
  const license = flag("license");
  const contact = flag("contact");

  if (!name || !url) {
    console.error("Usage: ai-txt generate --name \"My Site\" --url https://mysite.com [options]");
    console.error("\nOptions:");
    console.error("  --training  allow|deny|conditional  (default: deny)");
    console.error("  --scraping  allow|deny|conditional  (default: allow)");
    console.error("  --indexing  allow|deny|conditional  (default: allow)");
    console.error("  --caching   allow|deny|conditional  (default: allow)");
    console.error("  --license   SPDX license identifier");
    console.error("  --contact   Contact email");
    process.exit(1);
  }

  const site: AiTxtDocument["site"] = { name, url };
  if (contact) site.contact = contact;

  const doc: AiTxtDocument = {
    specVersion: "1.0",
    site,
    policies: { training, scraping, indexing, caching },
    agents: { "*": {} },
  };

  if (license) {
    doc.licensing = { license };
  }

  console.log(generate(doc));
}

function help() {
  console.log(`
  ai-txt — AI policy declaration standard

  Commands:
    check <url>     Check a site's AI policy
    generate        Generate an ai.txt file

  Examples:
    ai-txt check https://example.com
    ai-txt check https://example.com --agent ClaudeBot
    ai-txt generate --name "My Blog" --url https://myblog.com --training deny
    ai-txt generate --name "Open Wiki" --url https://wiki.org --training allow --license CC-BY-4.0
`);
}

if (command === "check" && args[1] && !args[1].startsWith("--")) {
  check(args[1]).catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  });
} else if (command === "generate") {
  gen();
} else {
  help();
}
