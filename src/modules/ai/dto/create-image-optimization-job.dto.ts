// DTO xác thực payload tạo job tối ưu ảnh tại Gateway.
// Gateway chỉ kiểm tra shape để chặn request sai sớm, còn ownership và provider vẫn do AI Service xử lý.

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export enum ImageOptimizationModeDto {
  WHITE_BACKGROUND = 'WHITE_BACKGROUND',
  LIFESTYLE_BACKGROUND = 'LIFESTYLE_BACKGROUND',
}

export enum LifestyleBackgroundPresetDto {
  MINIMAL_STUDIO = 'MINIMAL_STUDIO',
  WARM_HOME = 'WARM_HOME',
  NATURAL_OUTDOOR = 'NATURAL_OUTDOOR',
  PREMIUM_DISPLAY = 'PREMIUM_DISPLAY',
}

export enum SourceAssetPolicyDto {
  COVER_IMAGE = 'COVER_IMAGE',
  SELECTED_ASSETS = 'SELECTED_ASSETS',
}

// Kiểm tra lựa chọn background có giới hạn độ dài để không cho prompt tùy ý đi qua Gateway.
export class LifestyleBackgroundDto {
  @IsOptional()
  @IsEnum(LifestyleBackgroundPresetDto)
  preset?: LifestyleBackgroundPresetDto;

  @IsOptional()
  @IsString()
  // Cho phép chuỗi rỗng vì frontend gửi giá trị này khi seller chưa nhập mô tả tùy chỉnh.
  @ValidateIf((_object, value) => value !== undefined && value !== '')
  @Length(10, 400)
  description?: string;
}

// Kiểm tra batch job trước khi proxy sang AI Service, nhưng không chuyển business rule về Gateway.
export class CreateImageOptimizationJobDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  productIds!: string[];

  @IsString()
  @IsEnum(SourceAssetPolicyDto)
  sourceAssetPolicy!: SourceAssetPolicyDto;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  sourceAssetIds?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ArrayUnique()
  @IsEnum(ImageOptimizationModeDto, { each: true })
  modes!: ImageOptimizationModeDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => LifestyleBackgroundDto)
  background?: LifestyleBackgroundDto;

  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean;
}
