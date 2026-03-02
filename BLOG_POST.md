# ai.txt: Every Website Needs an AI Policy. Now There's a Standard for It.

## TL;DR

`ai.txt` is an open standard that lets any website declare its AI policy in a machine-readable file. Training permissions, licensing terms, per-agent rules, attribution requirements — in one file that AI systems can read automatically.

**robots.txt controls crawling. agents.txt declares capabilities. ai.txt declares AI policy.**

## The Problem

The New York Times sued OpenAI. Reddit sold its data for $60M. Stack Overflow licensed content to Google. Every week, another fight over AI training on web content.

But there's no standard way for a website to say: "You can crawl my content, but you cannot train on it."

`robots.txt` is binary — block or allow crawling. It can't express:
- "Crawl yes, train no"
- "Train allowed under CC-BY-4.0"
- "Claude can train, GPT cannot"
- "Free articles are open, premium articles are not"

Every publisher, blogger, and site owner needs these controls. None of them have them.

## The Solution

Drop a file at `/.well-known/ai.txt`:

```
# ai.txt
Spec-Version: 1.0

Site-Name: News Daily
Site-URL: https://newsdaily.com
Contact: ai@newsdaily.com

Training: conditional
Training-Allow: /articles/free/*
Training-Deny: /articles/premium/*
Training-License: CC-BY-4.0

Agent: ClaudeBot
  Training: allow

Agent: GPTBot
  Training: deny

Attribution: required
```

That's it. Machine-readable. Any AI system can check this file before interacting with the site.

## Who This Is For

**Every website.** Not just sites with APIs. Not just tech companies.

- **Bloggers**: "Don't train on my content" — 3 lines
- **News publishers**: "Train on free articles only, under CC-BY-4.0, attribution required"
- **E-commerce**: "AI can index products, but not cache pricing"
- **Corporations**: "No AI training, no scraping, audit required"
- **Open source projects**: "Train freely under MIT"
- **Artists & photographers**: "No training, no indexing, no caching"

## How It Works

### The Four Core Policies

| Policy | Default | What It Controls |
|--------|---------|-----------------|
| `Training` | deny | Can AI use content for model training? |
| `Scraping` | allow | Can AI agents read/scrape content? |
| `Indexing` | allow | Can AI index content for retrieval? |
| `Caching` | allow | Can AI cache content? |

Each accepts: `allow`, `deny`, or `conditional`.

### Per-Agent Control

Just like `robots.txt` has `User-agent:`, `ai.txt` has `Agent:` blocks:

```
Agent: *
  Rate-Limit: 60/minute

Agent: ClaudeBot
  Training: allow
  Rate-Limit: 200/minute

Agent: GPTBot
  Training: deny
  Scraping: deny
```

### Licensing

SPDX license identifiers — the same standard used by npm, GitHub, and every open source project:

```
Training-License: CC-BY-4.0
Training-Fee: https://example.com/ai-licensing
```

## The Standard Stack

`ai.txt` is part of a complete stack for AI-web interaction:

| Standard | Purpose | Audience |
|----------|---------|----------|
| `robots.txt` | "Don't crawl this" | Crawlers |
| `ai.txt` | "Here's our AI policy" | **All AI systems** |
| [`agents.txt`](https://github.com/kaylacar/agents-txt) | "Here's what agents can do" | AI agents with API access |

`ai.txt` and [`agents.txt`](https://github.com/kaylacar/agents-txt) are companion standards by the same author. `ai.txt` covers policy (training, licensing, attribution). `agents.txt` covers capabilities (endpoints, auth, protocols). A site can serve both.

## Getting Started

### npm Packages

```bash
npm install @ai-txt/core     # Parser, generator, validator
npm install @ai-txt/express   # Express middleware
```

### Express — One Line

```typescript
import { aiTxt } from "@ai-txt/express";

app.use(aiTxt({
  site: { name: "My Site", url: "https://mysite.com" },
  policies: { training: "deny", scraping: "allow", indexing: "allow", caching: "allow" },
}));
```

Your site now serves `/.well-known/ai.txt` and `/.well-known/ai.json` automatically.

### Discover Any Site's Policy

```typescript
import { AiTxtClient } from "@ai-txt/core";

const client = new AiTxtClient();
const result = await client.discover("https://example.com");

if (result.success) {
  const { training } = result.document.policies;
  if (training === "deny") {
    console.log("Do not train on this site's content");
  }
}
```

## IANA Registration

We've filed for IANA well-known URI registration for both `ai.txt` and `ai.json`, following RFC 8615. The specification is published, the reference implementation is open source, and the IETF Internet-Draft is available.

## Links

- **Specification**: [SPEC.md](https://github.com/kaylacar/ai-txt/blob/master/SPEC.md)
- **Repository**: [github.com/kaylacar/ai-txt](https://github.com/kaylacar/ai-txt)
- **npm**: `@ai-txt/core`, `@ai-txt/express`
