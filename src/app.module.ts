import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AiProviderModule } from './ai-provider/ai-provider.module';
import { ChatModule } from './chat/chat.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { WebSearchModule } from './web-search/web-search.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // global default: 100 requests per minute per IP; stricter limits on auth/chat routes
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
    ]),
    PrismaModule,
    CryptoModule,
    AuthModule,
    UserModule,
    AiProviderModule,
    ChatModule,
    SubscriptionModule,
    WebSearchModule,
  ],
  providers: [
    // global rate limiting; per-route decorators tighten it
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
