import { ApiProperty } from "@nestjs/swagger";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
import { IsStellarPublicKey, IsUsername } from "../validators";

export enum ProfileVisibility {
  Private = "private",
  Unlisted = "unlisted",
  Public = "public",
}

export class ProfileSettingsDto {
  @ApiProperty({ example: "alice_123" })
  @IsString()
  @IsUsername()
  username!: string;

  @ApiProperty({ example: "G..." })
  @IsString()
  @IsStellarPublicKey()
  publicKey!: string;

  @ApiProperty({
    minimum: 1,
    example: 1,
    description:
      "Client-supplied expected version used for optimistic concurrency control on conditional updates.",
  })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({ example: "#6366f1" })
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  primaryColor!: string;

  @ApiProperty({ required: false, example: "https://example.com/avatar.png" })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(/^$|^https:\/\/[^\s]+$/)
  avatarUrl?: string | null;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MaxLength(160)
  bio!: string;

  @ApiProperty({ maxLength: 15 })
  @IsString()
  @MaxLength(15)
  @Matches(/^$|^[A-Za-z0-9_]+$/)
  twitterHandle!: string;

  @ApiProperty({ maxLength: 32 })
  @IsString()
  @MaxLength(32)
  discordHandle!: string;

  @ApiProperty({ maxLength: 39 })
  @IsString()
  @MaxLength(39)
  @Matches(/^$|^[A-Za-z0-9-]+$/)
  githubHandle!: string;

  @ApiProperty({
    required: false,
    enum: ProfileVisibility,
    example: ProfileVisibility.Public,
  })
  @IsOptional()
  @IsEnum(ProfileVisibility)
  visibility?: ProfileVisibility;

  @ApiProperty({ required: false, minimum: 1, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}