import { generate, generateJSON } from "@ai-txt/core";
import type { AiTxtDocument, SiteInfo, ContentPolicies, AgentPolicy, TrainingPaths, LicensingInfo, ContentRequirements, ComplianceConfig } from "@ai-txt/core";
import type { Request, Response, NextFunction } from "express";

export interface AiTxtOptions {
  /** Site identity. */
  site: SiteInfo;
  /** Content policies. */
  policies: ContentPolicies;
  /** Training path restrictions. */
  trainingPaths?: TrainingPaths;
  /** Licensing info. */
  licensing?: LicensingInfo;
  /** Per-agent policies. Default: wildcard. */
  agents?: Record<string, AgentPolicy>;
  /** Content requirements. */
  content?: ContentRequirements;
  /** Compliance config. */
  compliance?: ComplianceConfig;
  /** Allowed CORS origins. Default: ["*"]. */
  corsOrigins?: string[];
  /** Serve paths. Default: /.well-known/ai.txt and /.well-known/ai.json */
  paths?: { txt?: string; json?: string };
}

export function aiTxt(options: AiTxtOptions) {
  const doc: AiTxtDocument = {
    specVersion: "1.0",
    generatedAt: new Date().toISOString(),
    site: options.site,
    policies: {
      training: options.policies.training ?? "deny",
      scraping: options.policies.scraping ?? "allow",
      indexing: options.policies.indexing ?? "allow",
      caching: options.policies.caching ?? "allow",
    },
    trainingPaths: options.trainingPaths,
    licensing: options.licensing,
    agents: options.agents ?? { "*": {} },
    content: options.content,
    compliance: options.compliance,
  };

  const txtContent = generate(doc);
  const jsonContent = generateJSON(doc);

  const txtPath = options.paths?.txt ?? "/.well-known/ai.txt";
  const jsonPath = options.paths?.json ?? "/.well-known/ai.json";

  const corsOrigins = options.corsOrigins ?? ["*"];

  return function aiTxtMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (req.path !== txtPath && req.path !== jsonPath) {
      next();
      return;
    }

    // CORS
    const origin = req.headers.origin as string | undefined;
    if (corsOrigins.includes("*")) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (origin && corsOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Vary", "Origin");

    // Security headers
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");

    // OPTIONS
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    // Serve content
    if (req.path === txtPath) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(txtContent);
    } else {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(jsonContent);
    }
  };
}
