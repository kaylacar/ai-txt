---
title: The "ai.txt" and "ai.json" Well-Known URIs
abbrev: ai-txt
docname: draft-car-ai-txt-wellknown-00
date: 2026-02
category: info
ipr: trust200902
area: Applications and Real-Time
workgroup: Independent Submission

keyword:
  - AI policy
  - well-known URI
  - training policy
  - content licensing
  - machine learning

stand_alone: yes

pi:
  toc: yes
  sortrefs: yes
  symrefs: yes

author:
  - ins: K. Car
    name: Kayla Car
    organization: Independent
    email: contactkaylacard@gmail.com

normative:
  RFC2119:
  RFC8174:
  RFC8615:
  RFC9110:

informative:
  RFC9116:
    title: "A File Format to Aid in Security Vulnerability Disclosure"
    date: 2022-04
    author:
      - ins: E. Foudil
      - ins: Y. Shafranovich
  ROBOTS:
    title: "Robots Exclusion Protocol"
    target: https://www.rfc-editor.org/rfc/rfc9309
    date: 2022-09
  SPDX:
    title: "SPDX License List"
    target: https://spdx.org/licenses/
    date: 2024

--- abstract

This document registers two Well-Known URIs under the "/.well-known/"
path: "ai.txt" and "ai.json". These URIs define a machine-readable
policy declaration format that allows website operators to declare
their AI policy — whether AI systems may train on their content,
which AI agents are permitted, under what licensing terms, and what
compliance requirements apply.

The format is designed to be complementary to "robots.txt" {{ROBOTS}},
which controls crawl access. Where "robots.txt" can block crawling
entirely, "ai.txt" expresses nuanced policies such as "you may crawl
but not train on this content" — a distinction that "robots.txt"
cannot express.

--- middle

# Introduction

AI systems increasingly interact with website content in ways that go
beyond traditional crawling: training language models on web content,
indexing content for retrieval-augmented generation, caching content
for future reference, and scraping data for analysis. Website
operators currently have no standard, machine-readable mechanism to
communicate their policies regarding these AI-specific uses.

"robots.txt" {{ROBOTS}} can block crawling entirely, but it cannot
express nuanced policies. A newspaper may wish to allow crawling
(for search indexing) while prohibiting training (for model development).
A blog may wish to allow training under a specific license. A
corporation may wish to allow some AI agents while blocking others.

"ai.txt" addresses this gap. It is a policy declaration file, served
at a well-known location, that communicates to AI systems:

- Whether content may be used for AI model training
- Whether content may be scraped, indexed, or cached
- Under what license terms AI training is permitted
- Which AI agents are permitted and under what conditions
- What attribution and disclosure requirements apply
- What compliance and audit expectations exist

## Relationship to Existing Standards

"ai.txt" is complementary to, and does not replace, existing standards:

robots.txt {{ROBOTS}}:
: Declares crawling restrictions. "ai.txt" adds training, licensing,
  and per-agent policy declarations that "robots.txt" cannot express.
  Both files may coexist.

agents.txt:
: Declares AI agent capabilities (endpoints, protocols, auth).
  "ai.txt" declares policy. A site may use both: "agents.txt" to
  declare what agents can DO, and "ai.txt" to declare what is ALLOWED.

security.txt {{RFC9116}}:
: Declares security vulnerability disclosure contacts. Similar
  well-known file pattern; different domain.

## Requirements Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and
"OPTIONAL" in this document are to be interpreted as described in
BCP 14 {{RFC2119}} {{RFC8174}} when, and only when, they appear in all
capitals, as shown here.

# The "ai.txt" Well-Known URI

## Location

The "ai.txt" file MUST be served at:

~~~
https://example.com/.well-known/ai.txt
~~~

The file MUST be served over HTTPS in production deployments. HTTP
is permitted only in development or testing environments.

The file MUST be served with Content-Type "text/plain; charset=utf-8".

## Format

The "ai.txt" file uses a block-based key-value format inspired by
"robots.txt". Each line contains a key, a colon, and a value. Lines
beginning with "#" are comments. Indented lines (two or more spaces,
or one or more tabs) belong to the preceding block.

A minimal "ai.txt" file:

~~~
# ai.txt
# Spec-Version: 1.0
Site-Name: My Blog
Site-URL: https://myblog.com
Training: deny
~~~

## Site Fields

Site-Name (REQUIRED):
: Human-readable name of the site or service.

Site-URL (REQUIRED):
: Canonical HTTPS URL of the site.

Description (OPTIONAL):
: Brief description of the site.

Contact (OPTIONAL):
: Contact email for AI policy inquiries.

Policy-URL (OPTIONAL):
: URL to a human-readable AI policy page.

## Content Policy Fields

These fields declare site-wide defaults. Each accepts one of:
"allow", "deny", or "conditional".

Training (OPTIONAL, default "deny"):
: Whether AI systems may use content for model training.

Scraping (OPTIONAL, default "allow"):
: Whether AI agents may scrape or read content.

Indexing (OPTIONAL, default "allow"):
: Whether AI systems may index content for retrieval.

Caching (OPTIONAL, default "allow"):
: Whether AI systems may cache content.

## Training Path Fields

When Training is "conditional", these fields specify per-path rules:

Training-Allow (OPTIONAL):
: Glob pattern for paths where training is permitted.

Training-Deny (OPTIONAL):
: Glob pattern for paths where training is denied.

Multiple Training-Allow and Training-Deny lines MAY appear.
More specific patterns take precedence.

## Licensing Fields

Training-License (OPTIONAL):
: SPDX license identifier {{SPDX}} for AI training use
  (e.g., "CC-BY-4.0").

Training-Fee (OPTIONAL):
: URL to commercial licensing or pricing page.

## Agent Blocks

Agent blocks declare per-agent policy overrides. The wildcard "*"
sets the default for all agents.

~~~
Agent: *
  Rate-Limit: 60/minute

Agent: ClaudeBot
  Training: allow
  Rate-Limit: 200/minute

Agent: GPTBot
  Training: deny
  Scraping: deny
~~~

Agent identifiers SHOULD match the first token of the agent's
User-Agent header (case-insensitive).

Fields within an Agent block:

- Training, Scraping, Indexing, Caching: Override site-wide policy
- Rate-Limit: Advisory rate limit in "N/window" format (second,
  minute, hour, day)

## Content Requirement Fields

Attribution (OPTIONAL):
: Whether AI outputs must attribute the source. One of: "required",
  "recommended", "none".

AI-Disclosure (OPTIONAL):
: Whether AI-generated content derived from this site must be
  disclosed as AI-generated. One of: "required", "recommended",
  "none".

## Compliance Fields

Audit (OPTIONAL):
: Whether AI agents must provide audit receipts. One of: "required",
  "optional", "none".

Audit-Format (OPTIONAL):
: Expected audit format identifier (e.g., "rer-artifact/0.1").

# The "ai.json" Well-Known URI

## Location

The JSON companion file MUST be served at:

~~~
https://example.com/.well-known/ai.json
~~~

The file MUST be served with Content-Type
"application/json; charset=utf-8".

## Format

The JSON format contains equivalent information to "ai.txt" in a
typed JSON structure suitable for direct consumption by programmatic
clients. The "ai.txt" file MAY reference the JSON file via:

~~~
AI-JSON: https://example.com/.well-known/ai.json
~~~

A minimal "ai.json" document:

~~~ json
{
  "specVersion": "1.0",
  "site": {
    "name": "My Blog",
    "url": "https://myblog.com"
  },
  "policies": {
    "training": "deny",
    "scraping": "allow",
    "indexing": "allow",
    "caching": "allow"
  },
  "agents": {
    "*": {}
  }
}
~~~

Field semantics are identical to those defined in Section 2 for the
text format.

# Agent Behavior

## Discovery

AI agents and crawlers SHOULD fetch "/.well-known/ai.txt" and/or
"/.well-known/ai.json" before interacting with an unfamiliar site.

Agents SHOULD prefer the JSON format when both are available.

Agents SHOULD cache the policy for the duration declared by the HTTP
Cache-Control header, with a minimum TTL of 60 seconds.

## Compliance

"ai.txt" is advisory. It declares the site owner's policy.
Compliance is expected in good faith but is not enforced by the
file itself.

Agents SHOULD respect Training declarations by not using content
for model training when Training is "deny".

Agents SHOULD respect rate limit declarations.

Servers MUST enforce rate limits and access control independently
of the declarations in "ai.txt".

# Security Considerations

Policy declarations MUST NOT include actual credentials, tokens, or
secrets of any kind.

"ai.txt" is advisory; servers MUST enforce policies independently.

Agents MUST validate that referenced URLs use HTTPS before following
them.

Site owners SHOULD review their "ai.txt" periodically to ensure it
accurately reflects current policy.

# IANA Considerations

## Well-Known URI Registration: "ai.txt"

This document requests registration of the following Well-Known URI
in the "Well-Known URIs" registry established by {{RFC8615}}:

URI suffix:
: ai.txt

Change controller:
: Kayla Car

Specification document(s):
: This document.

Related information:
: Text-format AI policy declaration file. Allows website operators
  to declare their AI content policy — training permissions, licensing
  terms, per-agent rules, and compliance requirements.

## Well-Known URI Registration: "ai.json"

URI suffix:
: ai.json

Change controller:
: Kayla Car

Specification document(s):
: This document.

Related information:
: JSON-format AI policy declaration file. Companion format to ai.txt.

--- back

# Example: News Site

~~~
# ai.txt — AI Policy Declaration
# Spec-Version: 1.0

Site-Name: News Daily
Site-URL: https://newsdaily.com
Contact: ai@newsdaily.com
Policy-URL: https://newsdaily.com/ai-policy

Training: conditional
Scraping: allow
Indexing: allow
Caching: allow

Training-Allow: /articles/free/*
Training-Deny: /articles/premium/*
Training-License: CC-BY-4.0
Training-Fee: https://newsdaily.com/ai-licensing

Agent: *
  Rate-Limit: 30/minute

Agent: ClaudeBot
  Training: allow
  Rate-Limit: 120/minute

Agent: GPTBot
  Training: deny

Attribution: required
AI-Disclosure: required
~~~

# Acknowledgments

The "ai.txt" format draws on the design of "robots.txt" {{ROBOTS}}
and "security.txt" {{RFC9116}} for structural inspiration. The SPDX
license identifiers referenced in Training-License are maintained
by the Linux Foundation {{SPDX}}.
