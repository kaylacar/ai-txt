import express from "express";
import { aiTxt } from "@ai-txt/express";

const app = express();

// One line to declare your site's AI policy
app.use(
  aiTxt({
    site: {
      name: "Example Blog",
      url: "https://example.com",
      contact: "ai-policy@example.com",
    },
    policies: {
      training: "conditional",
      scraping: "allow",
      indexing: "allow",
      caching: "allow",
    },
    trainingPaths: {
      allow: ["/blog/public/*"],
      deny: ["/blog/premium/*"],
    },
    licensing: {
      license: "CC-BY-4.0",
    },
    agents: {
      "*": { rateLimit: { requests: 60, window: "minute" } },
      ClaudeBot: { training: "allow", rateLimit: { requests: 200, window: "minute" } },
      GPTBot: { training: "deny", scraping: "deny" },
    },
    content: {
      attribution: "required",
    },
  })
);

app.get("/", (_req, res) => {
  res.send("Visit /.well-known/ai.txt to see this site's AI policy");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`AI policy: http://localhost:${port}/.well-known/ai.txt`);
  console.log(`AI policy (JSON): http://localhost:${port}/.well-known/ai.json`);
});
