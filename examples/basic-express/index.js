import express from "express";
import { aiTxt } from "@ai-txt/express";

const app = express();

app.use(
  aiTxt({
    site: {
      name: "News Daily",
      url: "https://newsdaily.example.com",
      description: "A news site demonstrating ai.txt policy declaration",
      contact: "ai-policy@newsdaily.example.com",
      policyUrl: "https://newsdaily.example.com/ai-policy",
    },
    policies: {
      training: "conditional",
      scraping: "allow",
      indexing: "allow",
      caching: "allow",
    },
    trainingPaths: {
      allow: ["/articles/free/*"],
      deny: ["/articles/premium/*"],
    },
    licensing: {
      license: "CC-BY-4.0",
      feeUrl: "https://newsdaily.example.com/ai-licensing",
    },
    agents: {
      "*": { rateLimit: { requests: 30, window: "minute" } },
      ClaudeBot: { training: "allow", rateLimit: { requests: 120, window: "minute" } },
      GPTBot: { training: "deny" },
    },
    content: {
      attribution: "required",
      aiDisclosure: "required",
    },
    compliance: {
      audit: "optional",
    },
  })
);

// Homepage
app.get("/", (_req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html>
<head><title>News Daily — ai.txt Demo</title></head>
<body>
<h1>News Daily</h1>
<p>This is a demo site showing <a href="https://github.com/kaylacar/ai-txt">ai.txt</a> in action.</p>
<h2>AI Policy Files</h2>
<ul>
  <li><a href="/.well-known/ai.txt">/.well-known/ai.txt</a> — human-readable policy</li>
  <li><a href="/.well-known/ai.json">/.well-known/ai.json</a> — machine-readable policy</li>
</ul>
<h2>Policy Summary</h2>
<ul>
  <li>Training: <strong>conditional</strong> — free articles allowed (CC-BY-4.0), premium denied</li>
  <li>Scraping: <strong>allow</strong></li>
  <li>ClaudeBot: training allowed at 120 req/min</li>
  <li>GPTBot: training denied</li>
  <li>Attribution: required</li>
</ul>
<h2>Content</h2>
<ul>
  <li><a href="/articles/free/intro-to-ai">Free article — training allowed</a></li>
  <li><a href="/articles/premium/deep-dive">Premium article — training denied</a></li>
</ul>
</body>
</html>`);
});

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Free article — training allowed per trainingPaths
app.get("/articles/free/:slug", (req, res) => {
  const slug = escapeHtml(req.params.slug);
  res.type("html").send(`<!DOCTYPE html>
<html>
<head><title>${slug} — News Daily</title></head>
<body>
<h1>${slug}</h1>
<p>This is a free article. Training is <strong>allowed</strong> on this path (/articles/free/*).</p>
<p>License: CC-BY-4.0. Attribution required.</p>
<a href="/">← Back</a>
</body>
</html>`);
});

// Premium article — training denied per trainingPaths
app.get("/articles/premium/:slug", (req, res) => {
  const slug = escapeHtml(req.params.slug);
  res.type("html").send(`<!DOCTYPE html>
<html>
<head><title>${slug} — News Daily</title></head>
<body>
<h1>${slug}</h1>
<p>This is a premium article. Training is <strong>denied</strong> on this path (/articles/premium/*).</p>
<p>For AI training licensing: <a href="/ai-licensing">/ai-licensing</a></p>
<a href="/">← Back</a>
</body>
</html>`);
});

app.get("/ai-policy", (_req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html>
<head><title>AI Policy — News Daily</title></head>
<body>
<h1>AI Policy</h1>
<p>Free articles may be used for AI training under CC-BY-4.0 with attribution.</p>
<p>Premium articles may not be used for training without a commercial license.</p>
<p>See <a href="/.well-known/ai.txt">ai.txt</a> for the machine-readable version.</p>
</body>
</html>`);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`News Daily demo running at http://localhost:${port}`);
  console.log(`ai.txt:  http://localhost:${port}/.well-known/ai.txt`);
  console.log(`ai.json: http://localhost:${port}/.well-known/ai.json`);
});
