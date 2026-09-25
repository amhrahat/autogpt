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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateProviderDto, UpdateProviderDto } from './dto/provider.dto';
import { AiProviderService } from './ai-provider.service';

interface RequestWithUser extends Request {
  user?: { sub: string; email: string; role: string };
}

@ApiTags('ai-providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('providers')
export class AiProviderController {
  constructor(private readonly providerService: AiProviderService) {}

  @Get()
  @ApiOperation({ summary: 'List own AI providers' })
  list(@Req() req: RequestWithUser) {
    return this.providerService.list(req.user!.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one AI provider' })
  findOne(@Req() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.providerService.findOne(req.user!.sub, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an AI provider' })
  create(@Req() req: RequestWithUser, @Body() dto: CreateProviderDto) {
    return this.providerService.create(req.user!.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an AI provider' })
  update(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProviderDto,
  ) {
    return this.providerService.update(req.user!.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an AI provider' })
  remove(@Req() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.providerService.remove(req.user!.sub, id);
  }

  @Post(':id/health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run a health check against the provider' })
  healthCheck(@Req() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.providerService.healthCheck(req.user!.sub, id);
  }
}
