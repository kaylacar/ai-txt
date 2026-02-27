# @ai-txt/express

Express middleware for serving [ai.txt](https://github.com/kaylacar/ai-txt) — one line to declare your site's AI policy.

## Install

```bash
npm install @ai-txt/express
```

## Usage

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

## License

MIT — see [LICENSE](../../LICENSE)
