# IANA Well-Known URI Registration Submission

## How to Submit

File issues at: https://github.com/protocol-registries/well-known-uris/issues

Submit the following registrations (one per issue).

---

## Registration 1: ai.txt

**URI suffix:** ai.txt

**Change controller:** Kayla Car <contactkaylacard@gmail.com>

**Specification document(s):**
https://github.com/kaylacar/ai-txt/blob/master/SPEC.md

**Related information:**
Text-format AI policy declaration file. Allows website operators to
declare their AI content policy — whether AI systems may train on
content, which AI agents are permitted, under what licensing terms
(SPDX identifiers), and what compliance requirements apply.
Complementary to robots.txt (which controls crawling); ai.txt declares
nuanced AI-specific policies such as "you may crawl but not train on
this content" — a distinction robots.txt cannot express.

---

## Registration 2: ai.json

**URI suffix:** ai.json

**Change controller:** Kayla Car <contactkaylacard@gmail.com>

**Specification document(s):**
https://github.com/kaylacar/ai-txt/blob/master/SPEC.md

**Related information:**
JSON-format companion to ai.txt. Contains equivalent AI policy
declaration information in a typed JSON structure for programmatic
consumption. Served at /.well-known/ai.json alongside the text
format.

---

## After Submitting

The submission triggers an expert review process. A designated
reviewer will evaluate whether the specification is sufficiently
stable and the use case is legitimate.

To strengthen the submission:

1. Submit the Internet-Draft to the IETF datatracker at:
   https://datatracker.ietf.org/submit/

2. Post to the "apps-discuss" IETF mailing list:
   https://www.ietf.org/mailman/listinfo/apps-discuss

3. Keep the specification document at a stable, publicly accessible URL.
