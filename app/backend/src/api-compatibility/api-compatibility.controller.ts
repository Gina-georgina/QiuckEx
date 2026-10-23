import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCompatibilityService } from './api-compatibility.service';
import { NetworkSafetyGuard } from '../common/guards/network-safety.guard';
import { FeatureFlag } from '../common/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from '../common/guards/feature-flag.guard';

export const API_COMPATIBILITY_BREAKING_CHANGES = 'API_COMPATIBILITY_BREAKING_CHANGES';

@Controller('api-compatibility')
export class ApiCompatibilityController {
  constructor(private readonly apiCompatibilityService: ApiCompatibilityService) {}

  @Get('report')
  async getReport() {
    return this.apiCompatibilityService.getCompatibilityReport();
  }

  @Post('assert')
  @FeatureFlag('apiCompatibilityAssert')
  @UseGuards(FeatureFlagGuard, NetworkSafetyGuard)
  async assertCompatibility(@Body() body: { baseline?: string } = {}) {
    const report = await this.apiCompatibilityService.getCompatibilityReport(body?.baseline);

    if (report.breakingChanges && report.breakingChanges.length > 0) {
      throw new HttpException(
        {
          code: API_COMPATIBILITY_BREAKING_CHANGES,
          message: 'API compatibility check failed: breaking changes detected',
          breakingChanges: report.breakingChanges,
        },
        HttpStatus.CONFLICT,
      );
    }

    return {
      compatible: true,
      report,
    };
  }
}
</｜｜DSML｜｜ parameter>
</｜｜DSML｜｜ invoke>
</｜｜DSML｜｜ calls>