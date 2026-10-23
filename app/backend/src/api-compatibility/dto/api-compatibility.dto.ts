import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Classification of a detected API change.
 */
export enum ChangeClassification {
  BREAKING = 'breaking',
  NON_BREAKING = 'non-breaking',
}

/**
 * Kind of API change detected between two API versions.
 */
export enum ChangeKind {
  PATH_REMOVED = 'path-removed',
  PATH_ADDED = 'path-added',
  METHOD_REMOVED = 'method-removed',
  METHOD_ADDED = 'method-added',
  REQUIRED_FIELD_ADDED = 'required-field-added',
  OPTIONAL_FIELD_ADDED = 'optional-field-added',
  FIELD_REMOVED = 'field-removed',
  FIELD_TYPE_CHANGED = 'field-type-changed',
  ENUM_NARROWED = 'enum-narrowed',
  ENUM_WIDENED = 'enum-widened',
  ERROR_CODE_REMOVED = 'error-code-removed',
  ERROR_CODE_ADDED = 'error-code-added',
  RESPONSE_SCHEMA_CHANGED = 'response-schema-changed',
  REQUEST_SCHEMA_CHANGED = 'request-schema-changed',
  PARAMETER_REMOVED = 'parameter-removed',
  PARAMETER_ADDED = 'parameter-added',
  PARAMETER_REQUIRED = 'parameter-required',
  PARAMETER_OPTIONAL = 'parameter-optional',
  AUTH_REQUIREMENT_CHANGED = 'auth-requirement-changed',
  OTHER = 'other',
}

/**
 * A single detected change between two API versions.
 */
export class ApiChangeDto {
  @ApiProperty({
    description: 'Classification of the change',
    enum: ChangeClassification,
    example: ChangeClassification.BREAKING,
  })
  @IsEnum(ChangeClassification)
  classification!: ChangeClassification;

  @ApiProperty({
    description: 'Kind of the change',
    enum: ChangeKind,
    example: ChangeKind.PATH_REMOVED,
  })
  @IsEnum(ChangeKind)
  kind!: ChangeKind;

  @ApiProperty({
    description: 'HTTP path affected by the change',
    example: '/users/{id}',
  })
  @IsString()
  @IsNotEmpty()
  path!: string;

  @ApiPropertyOptional({
    description: 'HTTP method affected by the change',
    example: 'GET',
  })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({
    description: 'Location within the API definition (e.g. JSON pointer)',
    example: '#/paths/~1users~1{id}/get/responses/200',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({
    description: 'Human-readable description of the change',
    example: 'Path /users/{id} was removed',
  })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiPropertyOptional({
    description: 'Previous value before the change',
  })
  @IsOptional()
  previousValue?: unknown;

  @ApiPropertyOptional({
    description: 'New value after the change',
  })
  @IsOptional()
  newValue?: unknown;
}

/**
 * Summary counts for a compatibility report.
 */
export class ApiCompatibilitySummaryDto {
  @ApiProperty({
    description: 'Total number of detected changes',
    example: 5,
  })
  totalChanges!: number;

  @ApiProperty({
    description: 'Number of breaking changes',
    example: 2,
  })
  breakingChanges!: number;

  @ApiProperty({
    description: 'Number of non-breaking changes',
    example: 3,
  })
  nonBreakingChanges!: number;
}

/**
 * Full compatibility report comparing two API versions.
 */
export class ApiCompatibilityReportDto {
  @ApiProperty({
    description: 'Whether the new API version is backward compatible',
    example: false,
  })
  @IsBoolean()
  compatible!: boolean;

  @ApiProperty({
    description: 'Identifier of the base (old) API version',
    example: '1.0.0',
  })
  @IsString()
  @IsNotEmpty()
  baseVersion!: string;

  @ApiProperty({
    description: 'Identifier of the target (new) API version',
    example: '2.0.0',
  })
  @IsString()
  @IsNotEmpty()
  targetVersion!: string;

  @ApiProperty({
    description: 'Summary of the report',
    type: ApiCompatibilitySummaryDto,
  })
  @ValidateNested()
  @Type(() => ApiCompatibilitySummaryDto)
  summary!: ApiCompatibilitySummaryDto;

  @ApiProperty({
    description: 'List of detected changes',
    type: [ApiChangeDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApiChangeDto)
  changes!: ApiChangeDto[];

  @ApiPropertyOptional({
    description: 'Timestamp when the report was generated',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  generatedAt?: string;
}

/**
 * Request payload for overriding a compatibility check result.
 */
export class ApiCompatibilityOverrideRequestDto {
  @ApiProperty({
    description: 'Identifier of the base (old) API version',
    example: '1.0.0',
  })
  @IsString()
  @IsNotEmpty()
  baseVersion!: string;

  @ApiProperty({
    description: 'Identifier of the target (new) API version',
    example: '2.0.0',
  })
  @IsString()
  @IsNotEmpty()
  targetVersion!: string;

  @ApiProperty({
    description: 'Whether the compatibility check should be overridden',
    example: true,
  })
  @IsBoolean()
  override!: boolean;

  @ApiPropertyOptional({
    description: 'Reason for the override',
    example: 'Breaking change approved by API governance board',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Specific change kinds to override',
    enum: ChangeKind,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ChangeKind, { each: true })
  changeKinds?: ChangeKind[];
}

/**
 * Response payload for a compatibility override operation.
 */
export class ApiCompatibilityOverrideResponseDto {
  @ApiProperty({
    description: 'Whether the override was applied successfully',
    example: true,
  })
  @IsBoolean()
  success!: boolean;

  @ApiProperty({
    description: 'Identifier of the base (old) API version',
    example: '1.0.0',
  })
  @IsString()
  @IsNotEmpty()
  baseVersion!: string;

  @ApiProperty({
    description: 'Identifier of the target (new) API version',
    example: '2.0.0',
  })
  @IsString()
  @IsNotEmpty()
  targetVersion!: string;

  @ApiProperty({
    description: 'Whether the API is considered compatible after the override',
    example: true,
  })
  @IsBoolean()
  compatible!: boolean;

  @ApiPropertyOptional({
    description: 'Reason recorded for the override',
    example: 'Breaking change approved by API governance board',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Timestamp when the override was applied',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  appliedAt?: string;
}