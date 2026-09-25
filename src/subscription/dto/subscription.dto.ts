import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class ChangePlanDto {
  @ApiProperty({ enum: ['FREE', 'PRO', 'TEAM'] })
  @IsIn(['FREE', 'PRO', 'TEAM'])
  plan: 'FREE' | 'PRO' | 'TEAM';
}

export class AdminSubscriptionUpdateDto {
  @ApiPropertyOptional({ enum: ['FREE', 'PRO', 'TEAM'] })
  @IsOptional()
  @IsIn(['FREE', 'PRO', 'TEAM'])
  plan?: 'FREE' | 'PRO' | 'TEAM';

  @ApiPropertyOptional({ enum: ['ACTIVE', 'CANCELED', 'EXPIRED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'CANCELED', 'EXPIRED'])
  status?: 'ACTIVE' | 'CANCELED' | 'EXPIRED';

  @ApiPropertyOptional({ description: 'Override monthly request limit (-1 = unlimited)' })
  @IsOptional()
  @IsIn([-1, 100, 1000, 10000])
  monthlyLimit?: number;
}
