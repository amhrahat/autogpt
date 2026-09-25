import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';

/** Plan catalog — the simplest reasonable pricing model, no payment integration. */
export const PLAN_LIMITS: Record<SubscriptionPlan, number> = {
  FREE: 100,
  PRO: 1000,
  TEAM: -1, // unlimited
};

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  /** Finds the user's subscription, rolling the monthly period and resetting usage if it expired. */
  async getForUser(userId: string) {
    let subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (!subscription) {
      // self-heal: users created before subscriptions existed
      subscription = await this.prisma.subscription.create({
        data: {
          userId,
          plan: 'FREE',
          status: 'ACTIVE',
          monthlyLimit: PLAN_LIMITS.FREE,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
    if (subscription.currentPeriodEnd < new Date()) {
      subscription = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          requestsUsed: 0,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
    return subscription;
  }

  async getOverview(userId: string) {
    const subscription = await this.getForUser(userId);
    const remaining =
      subscription.monthlyLimit === -1
        ? null // unlimited
        : Math.max(0, subscription.monthlyLimit - subscription.requestsUsed);
    return {
      plan: subscription.plan,
      status: subscription.status,
      monthlyLimit: subscription.monthlyLimit,
      requestsUsed: subscription.requestsUsed,
      remainingRequests: remaining,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  }

  /** Upgrades/downgrades the plan; quota resets take effect immediately. */
  async changePlan(userId: string, plan: SubscriptionPlan) {
    await this.getForUser(userId);
    return this.prisma.subscription.update({
      where: { userId },
      data: {
        plan,
        status: 'ACTIVE',
        monthlyLimit: PLAN_LIMITS[plan],
        requestsUsed: 0,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  /** Throws 403 when the monthly quota is exhausted. Called before each chat completion. */
  async assertWithinQuota(userId: string) {
    const subscription = await this.getForUser(userId);
    if (subscription.status !== 'ACTIVE') {
      throw new ForbiddenException(`Subscription is ${subscription.status.toLowerCase()}`);
    }
    if (
      subscription.monthlyLimit !== -1 &&
      subscription.requestsUsed >= subscription.monthlyLimit
    ) {
      throw new ForbiddenException(
        'Monthly request quota exhausted. Upgrade your plan or wait for the next period.',
      );
    }
    return subscription;
  }

  async incrementUsage(userId: string) {
    await this.prisma.subscription.updateMany({
      where: { userId },
      data: { requestsUsed: { increment: 1 } },
    });
  }

  // ---- admin ----

  async listAll(page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
      this.prisma.subscription.count(),
    ]);
    return { items, total, page, limit };
  }

  async adminUpdate(id: string, data: { plan?: SubscriptionPlan; status?: string; monthlyLimit?: number }) {
    const subscription = await this.prisma.subscription.findUnique({ where: { id } });
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    return this.prisma.subscription.update({
      where: { id },
      data: {
        ...(data.plan !== undefined && {
          plan: data.plan,
          monthlyLimit: data.monthlyLimit ?? PLAN_LIMITS[data.plan],
        }),
        ...(data.monthlyLimit !== undefined && data.plan === undefined && { monthlyLimit: data.monthlyLimit }),
        ...(data.status !== undefined && { status: data.status as never }),
      },
    });
  }
}
