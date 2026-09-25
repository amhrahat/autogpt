import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubscriptionPlan } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY, Roles } from '../auth/guards/jwt-auth.guard';
import { Role } from '@prisma/client';
import { ChangePlanDto } from './dto/subscription.dto';
import { SubscriptionService } from './subscription.service';

interface RequestWithUser extends Request {
  user?: { sub: string; email: string; role: string };
}

@ApiTags('subscription')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own subscription with remaining requests' })
  me(@Req() req: RequestWithUser) {
    return this.subscriptionService.getOverview(req.user!.sub);
  }

  @Post('me/plan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upgrade or downgrade own plan (FREE/PRO/TEAM)' })
  changePlan(@Req() req: RequestWithUser, @Body() dto: ChangePlanDto) {
    return this.subscriptionService.changePlan(req.user!.sub, dto.plan as SubscriptionPlan);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/subscriptions')
export class AdminSubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[admin] List all subscriptions' })
  list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.subscriptionService.listAll(Number(page) || 1, Math.min(Number(limit) || 20, 100));
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[admin] Update a subscription (plan/status/limit)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: import('./dto/subscription.dto').AdminSubscriptionUpdateDto,
  ) {
    return this.subscriptionService.adminUpdate(id, dto);
  }
}
