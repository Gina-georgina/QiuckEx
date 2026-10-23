import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class AnnounceKeyRotationDto {
  @ApiProperty({ description: 'The new public key that will replace the current one.' })
  @IsString()
  @IsNotEmpty()
  newPublicKey!: string;

  @ApiProperty({ description: 'ISO 8601 timestamp at which the new key becomes effective.' })
  @IsISO8601()
  effectiveAt!: string;

  @ApiProperty({
    description: 'Grace period in milliseconds during which the old key remains valid.',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  gracePeriodMs?: number;

  @ApiProperty({ description: 'Unique nonce for replay protection.' })
  @IsString()
  @IsNotEmpty()
  nonce!: string;

  @ApiProperty({ description: 'Signature over the rotation announcement payload.' })
  @IsString()
  @IsNotEmpty()
  signature!: string;
}

export class RevokeKeyRotationDto {
  @ApiProperty({ description: 'Identifier of the key rotation to revoke.' })
  @IsString()
  @IsNotEmpty()
  rotationId!: string;

  @ApiProperty({ description: 'Unique nonce for replay protection.' })
  @IsString()
  @IsNotEmpty()
  nonce!: string;

  @ApiProperty({ description: 'Signature over the revocation payload.' })
  @IsString()
  @IsNotEmpty()
  signature!: string;
}

export class KeyRotationStatusDto {
  @ApiProperty({ description: 'Identifier of the key rotation.' })
  @IsString()
  @IsNotEmpty()
  rotationId!: string;

  @ApiProperty({ description: 'The public key being rotated out.' })
  @IsString()
  @IsNotEmpty()
  oldPublicKey!: string;

  @ApiProperty({ description: 'The public key being rotated in.' })
  @IsString()
  @IsNotEmpty()
  newPublicKey!: string;

  @ApiProperty({ description: 'Current status of the key rotation.' })
  @IsString()
  @IsNotEmpty()
  status!: string;

  @ApiProperty({ description: 'ISO 8601 timestamp at which the new key becomes effective.' })
  @IsISO8601()
  effectiveAt!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp at which the grace period ends.',
    required: false,
  })
  @IsOptional()
  @IsISO8601()
  graceEndsAt?: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp at which the rotation was revoked.',
    required: false,
  })
  @IsOptional()
  @IsISO8601()
  revokedAt?: string;
}