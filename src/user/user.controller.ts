import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/guards/jwt-auth.guard';
import { SetMetadata } from '@nestjs/common';
import { ChangePasswordDto, AdminUpdateUserDto, UpdateUserDto } from './dto/user.dto';
import { UserService } from './user.service';

interface RequestWithUser extends Request {
  user?: { sub: string; email: string; role: string };
}

@ApiTags('user')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own profile' })
  getProfile(@Req() req: RequestWithUser) {
    return this.userService.findOne(req.user!.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile' })
  updateProfile(@Req() req: RequestWithUser, @Body() dto: UpdateUserDto) {
    return this.userService.update(req.user!.sub, dto);
  }

  @Post('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change own password (revokes all sessions)' })
  changePassword(@Req() req: RequestWithUser, @Body() dto: ChangePasswordDto) {
    return this.userService.changePassword(req.user!.sub, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete own account and all related data' })
  deleteAccount(@Req() req: RequestWithUser) {
    return this.userService.remove(req.user!.sub);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/users')
export class AdminUserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @SetMetadata(ROLES_KEY, [Role.ADMIN])
  @ApiOperation({ summary: '[admin] List all users' })
  list() {
    return this.prismaList();
  }

  @Patch(':id')
  @SetMetadata(ROLES_KEY, [Role.ADMIN])
  @ApiOperation({ summary: '[admin] Change user role or active state' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminUpdateUserDto) {
    return this.userService.adminUpdate(id, dto);
  }

  @Delete(':id')
  @SetMetadata(ROLES_KEY, [Role.ADMIN])
  @ApiOperation({ summary: '[admin] Delete a user' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.remove(id);
  }

  private prismaList() {
    return this.userService.listAll();
  }
}
