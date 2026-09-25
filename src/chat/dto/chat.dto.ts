import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ description: 'Prompt text' })
  @IsString()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({ description: 'Existing conversation ID; omit to start a new one' })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional({ description: 'Provider to use; defaults to the user default provider' })
  @IsOptional()
  @IsUUID()
  providerId?: string;
}

export class ListMessagesDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}

export class UpdateConversationDto {
  @ApiProperty({ example: 'Refactoring plan' })
  @IsString()
  @MinLength(1)
  title: string;
}

export class HistoryQueryDto {
  @ApiPropertyOptional({ description: 'Filter by provider id' })
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class MessageContentDto {
  @ApiProperty({ enum: ['user', 'assistant', 'system'] })
  @IsIn(['user', 'assistant', 'system'])
  role: 'user' | 'assistant' | 'system';

  @ApiProperty()
  @IsString()
  content: string;
}

// re-export for swagger visibility of nested array validation
export class SendMessageWithHistoryDto extends SendMessageDto {
  @ApiPropertyOptional({ type: [MessageContentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageContentDto)
  history?: MessageContentDto[];
}
