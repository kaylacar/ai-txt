import type { ParseResult } from "./types.js";
import { parse } from "./parser.js";
import { parseJSON } from "./parser-json.js";
import { resolve, canAccess } from "./resolver.js";
import type { ResolvedPolicy, AccessResult } from "./resolver.js";

export interface ClientOptions {
  /** Request timeout in ms. Default: 10000. */
  timeout?: number;
  /** User-Agent header. Default: "ai-txt-client/1.0". */
  userAgent?: string;
  /** Cache TTL in ms. Default: 300000 (5 minutes). Set to 0 to disable. */
  cacheTtl?: number;
  /** Maximum response body size in bytes. Default: 1048576 (1 MB). */
  maxResponseSize?: number;
  /** Maximum number of cached entries. Default: 1000. Oldest entries evicted when full. */
  maxCacheSize?: number;
}

interface CacheEntry {
  result: ParseResult;
  etag?: string;
  expiresAt: number;
}

const WELL_KNOWN_TXT = "/.well-known/ai.txt";
const WELL_KNOWN_JSON = "/.well-known/ai.json";
const DEFAULT_CACHE_TTL = 300_000; // 5 minutes
const DEFAULT_MAX_RESPONSE_SIZE = 1_048_576; // 1 MB
const DEFAULT_MAX_CACHE_SIZE = 1_000;

/**
 * Client for discovering and fetching ai.txt from websites.
 *
 * Includes in-memory caching with ETag revalidation.
 * If a site has no ai.txt, the client returns `success: false` —
 * the absence of ai.txt does NOT imply any default policy.
 * Existing norms (robots.txt, terms of service) still apply.
 */
export class AiTxtClient {
  private timeout: number;
  private userAgent: string;
  private cacheTtl: number;
  private maxResponseSize: number;
  private maxCacheSize: number;
  private cache = new Map<string, CacheEntry>();

  constructor(options: ClientOptions = {}) {
    this.timeout = options.timeout ?? 10_000;
    this.userAgent = options.userAgent ?? "ai-txt-client/1.0";
    this.cacheTtl = options.cacheTtl ?? DEFAULT_CACHE_TTL;
    this.maxResponseSize = options.maxResponseSize ?? DEFAULT_MAX_RESPONSE_SIZE;
    this.maxCacheSize = options.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE;
  }

  /**
   * Discover ai.txt from a site. Tries ai.json first, falls back to ai.txt.
   * Results are cached per the configured TTL.
   */
  async discover(baseUrl: string): Promise<ParseResult> {
    if (!baseUrl.startsWith("https://") && !baseUrl.startsWith("http://localhost")) {
      return { success: false, errors: [{ message: "Only HTTPS URLs are supported (per spec security requirements)" }], warnings: [] };
    }
    const normalized = baseUrl.replace(/\/+$/, "");

    // Check cache
    const cached = this.getCached(normalized);
    if (cached) return cached;

    // Try JSON first (preferred by spec), fall back to text
    // fetchAndParse handles caching internally (preserves ETag + server TTL)
    const jsonResult = await this.fetchAndParse(`${normalized}${WELL_KNOWN_JSON}`, "json");
    if (jsonResult?.success) return jsonResult;

    const txtResult = await this.fetchAndParse(`${normalized}${WELL_KNOWN_TXT}`, "text");
    if (txtResult?.success) return txtResult;

    const notFound: ParseResult = {
      success: false,
      errors: [{ message: `No ai.txt found at ${normalized}` }],
      warnings: [],
    };
    return notFound;
  }

  /**
   * Discover ai.json from a site at /.well-known/ai.json.
   */
  async discoverJSON(baseUrl: string): Promise<ParseResult> {
    if (!baseUrl.startsWith("https://") && !baseUrl.startsWith("http://localhost")) {
      return { success: false, errors: [{ message: "Only HTTPS URLs are supported (per spec security requirements)" }], warnings: [] };
    }
    const normalized = baseUrl.replace(/\/+$/, "");

    const result = await this.fetchAndParse(`${normalized}${WELL_KNOWN_JSON}`, "json");
    if (result) return result;

    return {
      success: false,
      errors: [{ message: `No ai.json found at ${normalized}` }],
      warnings: [],
    };
  }

  /**
   * Discover a site's ai.txt and resolve the effective policy for this agent.
   * Returns the fully merged policy (agent override → wildcard → site-wide).
   */
  async check(baseUrl: string): Promise<{ success: boolean; policy?: ResolvedPolicy; errors: Array<{ message: string }> }> {
    const result = await this.discover(baseUrl);

    if (!result.success || !result.document) {
      return { success: false, errors: result.errors };
    }

    const policy = resolve(result.document, this.userAgent);
    return { success: true, policy, errors: [] };
  }

  /**
   * Discover a site's ai.txt and check whether a specific action is allowed.
   *
   * @param baseUrl   - The site's base URL.
   * @param field     - Which policy to check: "training", "scraping", "indexing", or "caching".
   * @param path      - Optional URL path for conditional training path matching.
   */
  async checkAccess(
    baseUrl: string,
    field: "training" | "scraping" | "indexing" | "caching",
    path?: string,
  ): Promise<{ success: boolean; access?: AccessResult; errors: Array<{ message: string }> }> {
    const result = await this.discover(baseUrl);

    if (!result.success || !result.document) {
      return { success: false, errors: result.errors };
    }

    const access = canAccess(result.document, this.userAgent, field, path);
    return { success: true, access, errors: [] };
  }

  /** Clear the in-memory cache. */
  clearCache(): void {
    this.cache.clear();
  }

  // ── Private ──

  private getCached(key: string): ParseResult | null {
    if (this.cacheTtl <= 0) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() < entry.expiresAt) {
      return entry.result;
    }

    // Expired — return null but keep entry for ETag revalidation
    return null;
  }

  private setCache(key: string, result: ParseResult, etag?: string): void {
    if (this.cacheTtl <= 0) return;

    // Evict oldest entry if cache is full
    if (!this.cache.has(key) && this.cache.size >= this.maxCacheSize) {
      const oldest = this.cache.keys().next().value!;
      this.cache.delete(oldest);
    }

    this.cache.set(key, {
      result,
      etag,
      expiresAt: Date.now() + this.cacheTtl,
    });
  }

  private async fetchAndParse(url: string, format: "json" | "text"): Promise<ParseResult | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        "User-Agent": this.userAgent,
      };

      // Send If-None-Match if we have a cached ETag for this URL
      const baseUrl = url.replace(/\/.well-known\/ai\.(txt|json)$/, "");
      const cached = this.cache.get(baseUrl);
      if (cached?.etag) {
        headers["If-None-Match"] = cached.etag;
      }

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      // 304 Not Modified — cache is still valid, extend TTL
      if (response.status === 304 && cached) {
        cached.expiresAt = Date.now() + this.cacheTtl;
        return cached.result;
      }

      if (!response.ok) return null;

      // Reject responses that exceed the size limit
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > this.maxResponseSize) {
        return null;
      }

      const body = await response.text();
      if (body.length > this.maxResponseSize) return null;
      const result = format === "json" ? parseJSON(body) : parse(body);

      // Store ETag for future revalidation
      const etag = response.headers.get("etag") ?? undefined;

      // Parse Cache-Control max-age if present
      const cacheControl = response.headers.get("cache-control");
      if (cacheControl && result.success) {
        const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
        if (maxAgeMatch) {
          const serverTtl = parseInt(maxAgeMatch[1], 10) * 1000;
          this.setCache(baseUrl, result, etag);
          const entry = this.cache.get(baseUrl);
          if (entry) entry.expiresAt = Date.now() + serverTtl;
          return result;
        }
      }

      if (result.success) {
        this.setCache(baseUrl, result, etag);
      }

      return result;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
