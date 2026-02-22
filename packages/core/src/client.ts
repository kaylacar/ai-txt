import type { ParseResult } from "./types.js";
import { parse } from "./parser.js";
import { parseJSON } from "./parser-json.js";

export interface ClientOptions {
  /** Request timeout in ms. Default: 10000. */
  timeout?: number;
  /** User-Agent header. Default: "ai-txt-client/0.1". */
  userAgent?: string;
}

const WELL_KNOWN_TXT = "/.well-known/ai.txt";
const WELL_KNOWN_JSON = "/.well-known/ai.json";

/**
 * Client for discovering and fetching ai.txt from websites.
 */
export class AiTxtClient {
  private timeout: number;
  private userAgent: string;

  constructor(options: ClientOptions = {}) {
    this.timeout = options.timeout ?? 10_000;
    this.userAgent = options.userAgent ?? "ai-txt-client/0.1";
  }

  /**
   * Discover ai.txt from a site at /.well-known/ai.txt.
   */
  async discover(baseUrl: string): Promise<ParseResult> {
    const normalized = baseUrl.replace(/\/+$/, "");

    const text = await this.fetchText(`${normalized}${WELL_KNOWN_TXT}`);
    if (text) return parse(text);

    return {
      success: false,
      errors: [{ message: `No ai.txt found at ${normalized}` }],
      warnings: [],
    };
  }

  /**
   * Discover ai.json from a site at /.well-known/ai.json.
   */
  async discoverJSON(baseUrl: string): Promise<ParseResult> {
    const normalized = baseUrl.replace(/\/+$/, "");

    const text = await this.fetchText(`${normalized}${WELL_KNOWN_JSON}`);
    if (text) return parseJSON(text);

    return {
      success: false,
      errors: [{ message: `No ai.json found at ${normalized}` }],
      warnings: [],
    };
  }

  private async fetchText(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": this.userAgent },
        signal: controller.signal,
      });

      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
