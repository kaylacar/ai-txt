# @ai-txt/core

Parser, generator, validator, resolver, HTTP client, and CLI for the [ai.txt](https://github.com/kaylacar/ai-txt) web standard.

## Install

```bash
npm install @ai-txt/core
```

## CLI

```bash
# Generate an ai.txt file
npx @ai-txt/core generate --name "My Blog" --url https://myblog.com --training deny

# Check any site's policy
npx @ai-txt/core check https://example.com
npx @ai-txt/core check https://example.com --agent ClaudeBot
```

## Usage

```typescript
import { AiTxtClient } from "@ai-txt/core";

const client = new AiTxtClient({ userAgent: "ClaudeBot" });

const { policy } = await client.check("https://example.com");
const { access } = await client.checkAccess("https://example.com", "training", "/blog/post-1");
```

## License

MIT — see [LICENSE](../../LICENSE)
