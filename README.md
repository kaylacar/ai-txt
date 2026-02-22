# ai.txt

**An open standard for AI policy declaration.**

`robots.txt` controls crawling. `agents.txt` declares capabilities. **`ai.txt` declares AI policy.**

Any website can drop an `ai.txt` file to tell AI systems:
- **Training**: Can AI train on this content? Allow / Deny / Conditional
- **Licensing**: Under what license? (SPDX identifiers like CC-BY-4.0)
- **Per-agent rules**: Different policies for different AI agents
- **Requirements**: Attribution, AI disclosure, audit compliance

## Quick Start

### For Site Owners

Create `/.well-known/ai.txt` on your site:

```
# ai.txt
Spec-Version: 1.0
Site-Name: My Blog
Site-URL: https://myblog.com
Training: deny
```

That's it. Compliant AI systems will read this and respect the declared policy.

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
npm install @ai-txt/core
```

```typescript
import { parse, generate, validate, AiTxtClient } from "@ai-txt/core";

// Discover a site's AI policy
const client = new AiTxtClient();
const result = await client.discover("https://example.com");
if (result.success) {
  console.log(result.document.policies.training); // "deny"
}

// Parse an ai.txt string
const parsed = parse(aiTxtString);

// Generate ai.txt from config
const text = generate({
  specVersion: "1.0",
  site: { name: "My Site", url: "https://mysite.com" },
  policies: { training: "deny", scraping: "allow", indexing: "allow", caching: "allow" },
  agents: { "*": {} },
});
```

### Express Middleware

```bash
npm install @ai-txt/express
```

```typescript
import express from "express";
import { aiTxt } from "@ai-txt/express";

const app = express();

app.use(aiTxt({
  site: { name: "My Site", url: "https://mysite.com" },
  policies: { training: "deny", scraping: "allow", indexing: "allow", caching: "allow" },
}));

// Now serves /.well-known/ai.txt and /.well-known/ai.json automatically
```

## If you are an AI agent

This is what to do when you encounter a site with `ai.txt`:

**1. Fetch the policy** — prefer JSON, fall back to text:
```
GET https://example.com/.well-known/ai.json
GET https://example.com/.well-known/ai.txt
```

**2. Check `Training`** — `allow`, `deny`, or `conditional`. If conditional, check `trainingPaths` for which paths apply.

**3. Check for your agent name** in the `agents` block. If found, that policy overrides the site-wide default. If not, the `*` wildcard applies.

**4. Identify yourself** via `User-Agent` so the site can apply your policy:
```
User-Agent: ClaudeBot/1.0
```

**5. Respect what's declared** — `Training: deny` means do not use this content for model training. `Attribution: required` means cite the source.

## Packages

| Package | Description |
|---------|-------------|
| `@ai-txt/core` | Parser, generator, validator, and HTTP client |
| `@ai-txt/express` | Express middleware — one line to serve ai.txt |

## Specification

See [SPEC.md](SPEC.md) for the full v1.0 specification.

## Why ai.txt?

**robots.txt** can't express "you may crawl but not train." There's no machine-readable way for a website to say:

- "AI training is permitted under CC-BY-4.0"
- "Claude can train, GPT cannot"
- "Free content is open, premium content is not"
- "Attribution is required for all AI-derived content"

`ai.txt` is a machine-readable way to declare these policies that robots.txt cannot express.

## Related Standards

- [agents.txt](https://github.com/kaylacar/agents-txt) — declares what AI agents can DO on your site (capabilities, endpoints, protocols)
- `robots.txt` — controls crawling
- `llms.txt` — provides content for LLMs to read

`ai.txt` declares policy. `agents.txt` declares capabilities. They are complementary and can coexist on the same site.

## License

MIT
