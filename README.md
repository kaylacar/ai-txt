# ai.txt

**An open standard for AI policy declaration.**

`robots.txt` controls crawling. `agents.txt` declares capabilities. **`ai.txt` declares AI policy.**

Any website can drop an `ai.txt` file to tell AI systems:
- **Training**: Can AI train on this content? Allow / Deny / Conditional
- **Licensing**: Under what license? (SPDX identifiers like CC-BY-4.0)
- **Per-agent rules**: Different policies for different AI agents
- **Requirements**: Attribution, AI disclosure, audit compliance

## Quick Start

### Generate with the CLI

```bash
npx @ai-txt/core generate --name "My Blog" --url https://myblog.com --training deny
```

### Check any site's policy

```bash
npx @ai-txt/core check https://example.com
npx @ai-txt/core check https://example.com --agent ClaudeBot
```

### For Site Owners

Create `/.well-known/ai.txt` on your site:

```
# ai.txt
Spec-Version: 1.0
Site-Name: My Blog
Site-URL: https://myblog.com
Training: deny
```

Compliant AI systems will read this and respect the declared policy.

### More Examples

**Allow training with attribution:**

```
# ai.txt
Spec-Version: 1.0
Site-Name: Open Knowledge Base
Site-URL: https://openknowledge.org
Training: allow
Training-License: CC-BY-4.0
Attribution: required
```

**Per-agent policies:**

```
# ai.txt
Spec-Version: 1.0
Site-Name: News Daily
Site-URL: https://newsdaily.com

Training: conditional
Training-Allow: /articles/free/*
Training-Deny: /articles/premium/*
Training-License: CC-BY-4.0

Agent: *
  Rate-Limit: 30/minute
Agent: ClaudeBot
  Training: allow
  Rate-Limit: 120/minute
Agent: GPTBot
  Training: deny
```

### For Developers

```bash
npm install @ai-txt/express
```

```typescript
import express from "express";
import { aiTxt } from "@ai-txt/express";

const app = express();

app.use(aiTxt({
  site: { name: "My Site", url: "https://mysite.com" },
  policies: { training: "deny" },
}));

// Now serves /.well-known/ai.txt and /.well-known/ai.json automatically
```

## If you are an AI agent

Fetch the policy before interacting with any site:

```
GET https://example.com/.well-known/ai.json
```

Fall back to `/.well-known/ai.txt` if JSON is not available.

If you are building agent tooling, use `@ai-txt/core` to resolve policy in one call:

```bash
npm install @ai-txt/core
```

```typescript
import { AiTxtClient } from "@ai-txt/core";

const client = new AiTxtClient({ userAgent: "ClaudeBot" });

const { policy } = await client.check("https://example.com");
// → { training: "allow", scraping: "allow", rateLimit: { requests: 200, window: "minute" } }

const { access } = await client.checkAccess("https://example.com", "training", "/blog/post-1");
// → { allowed: true, reason: 'path "/blog/post-1" matches allow pattern "/blog/*"' }
```

Policy resolution, agent-specific overrides, path matching, and conditional policies are all handled for you.

What the fields mean:

1. `Training` — `allow`, `deny`, or `conditional`. If conditional, check path rules.
2. Your agent name in the `agents` block overrides site-wide defaults. If not found, `*` applies.
3. Send your name in `User-Agent` so the site applies your policy.
4. `Training: deny` means do not use this content for model training. `Attribution: required` means cite the source.

## Packages

| Package | Description |
|---------|-------------|
| `@ai-txt/core` | Parser, generator, validator, resolver, HTTP client, and CLI |
| `@ai-txt/express` | Express middleware — one line to serve ai.txt |

## Specification

See [SPEC.md](SPEC.md) for the full v1.0 specification.

## Why ai.txt?

`robots.txt` can block a crawler but cannot express "you may crawl but not train on this content." There is no existing machine-readable standard for a website to declare:

- Training permitted under CC-BY-4.0
- Claude may train, GPT may not
- Free content is open, premium content is not
- Attribution is required for all AI-derived content

`ai.txt` fills that gap.

## The Stack

These four repos form a governance pipeline for AI agents on the internet: **declared, executed, proven.**

| Repo | Purpose |
|------|---------|
| [agents.txt](https://github.com/kaylacar/agents-txt) | Declares what agents can do on a site |
| **[ai.txt](https://github.com/kaylacar/ai-txt)** | **Declares AI policy — training, licensing, attribution** |
| [agents-protocol](https://github.com/kaylacar/agents-protocol) | Execution SDK — how agents perform declared actions |
| [rer](https://github.com/kaylacar/rer) | Cryptographic proof of what agents actually did |

```
declared (agents.txt / ai.txt) → executed (agents-protocol) → proven (rer)
```

All four are by the same author and designed to work together.

## License

MIT
