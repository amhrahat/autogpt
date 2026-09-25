import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard, Roles } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[admin] Dashboard counters' })
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get('analytics/usage')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[admin] Chat requests + tokens per day' })
  usage(@Query('days') days?: string) {
    return this.adminService.usageAnalytics(Math.min(Math.max(Number(days) || 30, 1), 365));
  }

  @Get('analytics/top-users')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[admin] Most active users in the window' })
  topUsers(@Query('days') days?: string, @Query('limit') limit?: string) {
    return this.adminService.topUsers(
      Math.min(Math.max(Number(days) || 30, 1), 365),
      Math.min(Number(limit) || 10, 100),
    );
  }

  @Get('logs')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[admin] API request logs (paginated)' })
  logs(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.requestLogs(Number(page) || 1, Math.min(Number(limit) || 20, 100));
  }

  @Get('health')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[admin] System health (DB latency, uptime, memory)' })
  health() {
    return this.adminService.systemHealth();
  }
}
