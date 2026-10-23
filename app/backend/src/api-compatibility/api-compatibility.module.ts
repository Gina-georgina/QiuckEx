import { Module } from '@nestjs/common';
import { ApiCompatibilityService } from './api-compatibility.service';
import { ApiCompatibilityController } from './api-compatibility.controller';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { AuditModule } from '../audit/audit.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [FeatureFlagsModule, AuditModule, SupabaseModule],
  controllers: [ApiCompatibilityController],
  providers: [ApiCompatibilityService],
  exports: [ApiCompatibilityService],
})
export class ApiCompatibilityModule {}