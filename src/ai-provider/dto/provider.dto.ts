import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProviderDto {
  @ApiProperty({ example: 'My OpenAI' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: ['openai', 'anthropic', 'custom'], example: 'openai' })
  @IsIn(['openai', 'anthropic', 'custom'])
  type: 'openai' | 'anthropic' | 'custom';

  @ApiProperty({ example: 'https://api.openai.com/v1' })
  @IsUrl()
  baseUrl: string;

  @ApiProperty({ description: 'Secret API key — encrypted at rest, never returned' })
  @IsString()
  @MinLength(8)
  apiKey: string;

  @ApiProperty({ example: 'gpt-4o-mini' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  model: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateProviderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: ['openai', 'anthropic', 'custom'] })
  @IsOptional()
  @IsIn(['openai', 'anthropic', 'custom'])
  type?: 'openai' | 'anthropic' | 'custom';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  baseUrl?: string;

  @ApiPropertyOptional({ description: 'Replace the stored API key' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  apiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Set as the default provider' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
