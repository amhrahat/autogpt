import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WebSearchDto } from './dto/web-search.dto';
import { WebSearchService } from './web-search.service';

interface RequestWithUser extends Request {
  user?: { sub: string; email: string; role: string };
}

@ApiTags('web-search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class WebSearchController {
  constructor(private readonly webSearchService: WebSearchService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Run a web search and persist it to history' })
  search(@Req() req: RequestWithUser, @Body() dto: WebSearchDto) {
    return this.webSearchService.search(req.user!.sub, dto.query, dto.limit);
  }

  @Get('history')
  @ApiOperation({ summary: 'Own search history (paginated)' })
  history(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.webSearchService.history(
      req.user!.sub,
      Number(page) || 1,
      Math.min(Number(limit) || 20, 100),
    );
  }

  @Get('recent')
  @ApiOperation({ summary: 'Recent distinct queries' })
  recent(@Req() req: RequestWithUser, @Query('take') take?: string) {
    return this.webSearchService.recent(req.user!.sub, Math.min(Number(take) || 10, 50));
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Live query suggestions' })
  suggestions(@Query('q') q?: string) {
    return this.webSearchService.suggestions(q ?? '');
  }
}
