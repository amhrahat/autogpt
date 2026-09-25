import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const DDG_HTML = 'https://html.duckduckgo.com/html/?q=';
const DDG_AUTOCOMPLETE = 'https://duckduckgo.com/ac/?q=';

@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);

  constructor(private prisma: PrismaService) {}

  /** Runs a DuckDuckGo search (no API key needed), returns and persists results. */
  async search(userId: string, query: string, limit: number) {
    const results = await this.fetchResults(query, limit);
    const record = await this.prisma.webSearch.create({
      data: { userId, query, results: results as never },
    });
    return { id: record.id, query, results, searchedAt: record.createdAt };
  }

  async history(userId: string, page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.webSearch.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.webSearch.count({ where: { userId } }),
    ]);
    return { items, total, page, limit };
  }

  /** Recent distinct queries — used for quick re-run in the extension UI. */
  async recent(userId: string, take: number) {
    const rows = await this.prisma.webSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { query: true, createdAt: true },
    });
    const seen = new Set<string>();
    const distinct: { query: string; searchedAt: Date }[] = [];
    for (const row of rows) {
      const key = row.query.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        distinct.push({ query: row.query, searchedAt: row.createdAt });
      }
      if (distinct.length >= take) break;
    }
    return distinct;
  }

  /** Query suggestions from DuckDuckGo autocomplete. */
  async suggestions(query: string): Promise<string[]> {
    try {
      const response = await fetch(`${DDG_AUTOCOMPLETE}${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return [];
      const data = (await response.json()) as { phrase?: string }[];
      return data.map((d) => d.phrase).filter((p): p is string => typeof p === 'string');
    } catch (err) {
      this.logger.warn(`Suggestions fetch failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  private async fetchResults(query: string, limit: number): Promise<SearchResult[]> {
    let html: string;
    try {
      const response = await fetch(`${DDG_HTML}${encodeURIComponent(query)}`, {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; EchoGPT/1.0)' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(`DuckDuckGo responded with HTTP ${response.status}`);
      }
      html = await response.text();
    } catch (err) {
      throw new ServiceUnavailableException(
        `Search failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }

    const results: SearchResult[] = [];
    // html.duckduckgo.com returns results as <a class="result__a" href="...">title</a>
    // plus a <a class="result__snippet">summary</a> — parse them pairwise with regex
    const linkRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetRe = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    const snippets: string[] = [];
    let sm: RegExpExecArray | null;
    while ((sm = snippetRe.exec(html)) !== null) snippets.push(this.stripTags(sm[1]));
    let lm: RegExpExecArray | null;
    let i = 0;
    while ((lm = linkRe.exec(html)) !== null && results.length < limit) {
      const rawUrl = lm[1];
      // ddg wraps external urls in a redirect: //duckduckgo.com/l/?uddg=<encoded>&...
      const uddg = /[?&]uddg=([^&]+)/.exec(rawUrl);
      const url = uddg ? decodeURIComponent(uddg[1]) : rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl;
      results.push({
        title: this.stripTags(lm[2]),
        url,
        snippet: snippets[i] ?? '',
      });
      i++;
    }
    return results;
  }

  private stripTags(html: string): string {
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
