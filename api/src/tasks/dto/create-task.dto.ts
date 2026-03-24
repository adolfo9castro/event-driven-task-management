import { IsString, IsNotEmpty, IsOptional, MaxLength, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskDto {
    @ApiProperty({ example: 'Review Q3 Financials' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    title: string;

    @ApiPropertyOptional({ example: 'Check the consolidated reports.' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ description: 'The UUID of the task creator', example: '550e8400-e29b-41d4-a716-446655440000' })
    @IsUUID()
    @IsNotEmpty()
    creatorId: string;

    @ApiPropertyOptional({ description: 'The UUID of the assigned user', example: '123e4567-e89b-12d3-a456-426614174000' })
    @IsUUID()
    @IsOptional()
    assigneeId?: string;

    @ApiPropertyOptional({ description: 'ISO-8601 formatted due date', example: '2026-12-31T23:59:59Z' })
    @IsDateString()
    @IsOptional()
    dueDate?: string;
}