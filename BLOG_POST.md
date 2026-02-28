# ai.txt: How Websites Connect with AI Agents

## TL;DR

AI agents are the new visitors. They don't just crawl — they read, summarize, buy, and come back constantly. But right now there's no standard way for a site to tell them the rules.

`ai.txt` fixes that. One file at `/.well-known/ai.txt` tells every agent: what they can train on, how to attribute you, which agents get access, and under what terms. Agents discover it automatically — like structured data, but for AI.

Sites that publish `ai.txt` get discovered, understood, and recommended — agents cite you, link to you, and send users your way. Clear rules in, traffic out.

## The Problem

AI agents are replacing crawlers. They don't just index your site — they read it, summarize it, act on it, and come back constantly. But there's no standard way to tell them the rules. Every site is making it up: custom headers, terms of service in legalese, or blocking everything and hoping for the best.

Meanwhile, the training question still has no answer. The New York Times sued OpenAI. Reddit sold its data for $60M. Stack Overflow licensed content to Google. `robots.txt` is binary — block or allow crawling. It can't express:
- "Crawl yes, train no"
- "Train allowed under CC-BY-4.0"
- "Claude can train, GPT cannot"
- "Free articles are open, premium articles are not"

Every site owner needs these controls — for both agents and training. None of them have them.

## The Solution

Drop a file at `/.well-known/ai.txt`:

```
# ai.txt
# Spec-Version: 1.0

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

That's it. Machine-readable. Agents check this before every interaction — and prefer sites that have it.

## Who This Is For

**Every website.** Not just sites with APIs. Not just tech companies. If agents are going to interact with your content, you should be the one setting the terms.

- **Bloggers**: "No training, no caching" — 3 lines, and agents that check will respect it
- **News publishers**: "Compliant agents get free articles under CC-BY-4.0 with attribution"
- **E-commerce**: "Agents can index products but not cache pricing. Rate limits per agent."
- **Corporations**: "No AI training, no scraping, audit trail required"
- **Open source projects**: "Train freely under MIT — with proper attribution"
- **Artists & photographers**: "No training, no indexing, no caching. Clear signal to every agent."

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
| `ai.txt` | "Here are the rules — agents that comply get preferred access" | **All AI systems** |
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
