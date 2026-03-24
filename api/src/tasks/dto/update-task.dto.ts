import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateTaskDto } from './create-task.dto';
import { TaskStatus } from '../entities/task.entity';

/**
 * Data Transfer Object for updating an existing Task.
 * Inherits all validation rules from CreateTaskDto but makes them optional.
 * Adds validation for the task status lifecycle.
 */
export class UpdateTaskDto extends PartialType(CreateTaskDto) {
    @ApiPropertyOptional({
        description: 'The current lifecycle stage of the task',
        enum: TaskStatus,
        example: TaskStatus.COMPLETED,
    })
    @IsEnum(TaskStatus)
    @IsOptional()
    status?: TaskStatus;
}