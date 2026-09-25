import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  /** Top-level dashboard counters. */
  async dashboard() {
    const [totalUsers, activeUsers, totalProviders, totalConversations, totalMessages, totalSearches, subscriptionsByPlan, requestsLast24h] =
      await this.prisma.$transaction([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.aiProvider.count(),
        this.prisma.conversation.count(),
        this.prisma.chatMessage.count(),
        this.prisma.webSearch.count(),
        this.prisma.subscription.groupBy({ by: ['plan'], _count: true, orderBy: { plan: 'asc' } }),
        this.prisma.apiUsageLog.count({
          where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        }),
      ]);
    return {
      totalUsers,
      activeUsers,
      totalProviders,
      totalConversations,
      totalMessages,
      totalSearches,
      subscriptionsByPlan: Object.fromEntries(
        subscriptionsByPlan.map((s) => [s.plan, s._count]),
      ),
      apiRequestsLast24h: requestsLast24h,
    };
  }

  /** Chat requests per day over the last N days. */
  async usageAnalytics(days: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.$queryRaw<{ day: Date; requests: bigint; tokens: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day,
             COUNT(*) AS requests,
             COALESCE(SUM("promptTokens" + "completionTokens"), 0) AS tokens
      FROM "ChatMessage"
      WHERE "createdAt" >= ${since} AND "role" = 'assistant'
      GROUP BY 1 ORDER BY 1 ASC`;
    return rows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      requests: Number(r.requests),
      tokens: Number(r.tokens),
    }));
  }

  /** Top users by chat activity in the window. */
  async topUsers(days: number, limit: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.chatMessage.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, email: true, name: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => ({
      user: byId.get(r.userId) ?? { id: r.userId, email: null, name: null },
      messages: r._count.id,
    }));
  }

  /** Recent API usage logs with user/provider context. */
  async requestLogs(page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.apiUsageLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { email: true } },
        },
      }),
      this.prisma.apiUsageLog.count(),
    ]);
    return { items, total, page, limit };
  }

  /** DB connectivity + row counts as a basic system health probe. */
  async systemHealth() {
    const started = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - started;
    return {
      status: 'ok',
      database: { connected: true, latencyMs: dbLatencyMs },
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      timestamp: new Date().toISOString(),
    };
  }
}
