import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data Transfer Object for Task creation.
 * Enforces validation rules before reaching the service layer.
 */
export class CreateTaskDto {
    @ApiProperty({
        description: 'The main title or summary of the task',
        example: 'Configure AWS S3 Bucket',
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    title: string;

    @ApiPropertyOptional({
        description: 'Detailed instructions or notes for the task',
        example: 'Ensure bucket policy allows public read for the /images prefix.',
    })
    @IsString()
    @IsOptional()
    description?: string;
}