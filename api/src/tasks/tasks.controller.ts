import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@ApiTags('Tasks')
@Controller('tasks')
export class TasksController {
    constructor(private readonly tasksService: TasksService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new task and trigger background events' })
    @ApiResponse({ status: 201, description: 'The task has been successfully created.' })
    @ApiResponse({ status: 400, description: 'Validation failed (Bad Request).' })
    create(@Body() createTaskDto: CreateTaskDto) {
        return this.tasksService.create(createTaskDto);
    }

    @Get()
    @ApiOperation({ summary: 'Retrieve all active tasks' })
    @ApiResponse({ status: 200, description: 'List of all active tasks.' })
    findAll() {
        return this.tasksService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Retrieve a specific task by its UUID' })
    @ApiParam({ name: 'id', description: 'The UUID of the task', type: 'string' })
    @ApiResponse({ status: 200, description: 'The requested task.' })
    @ApiResponse({ status: 404, description: 'Task not found.' })
    // ParseUUIDPipe ensures the ID format is secure before hitting the service
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.tasksService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Partially update a task (e.g., change status)' })
    @ApiParam({ name: 'id', description: 'The UUID of the task to update', type: 'string' })
    @ApiResponse({ status: 200, description: 'The updated task.' })
    @ApiResponse({ status: 400, description: 'Validation failed.' })
    @ApiResponse({ status: 404, description: 'Task not found.' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateTaskDto: UpdateTaskDto,
    ) {
        return this.tasksService.update(id, updateTaskDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Soft-delete a task' })
    @ApiParam({ name: 'id', description: 'The UUID of the task to delete', type: 'string' })
    @ApiResponse({ status: 204, description: 'The task has been successfully deleted.' })
    @ApiResponse({ status: 404, description: 'Task not found.' })
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.tasksService.remove(id);
    }

    @Post('reminders/trigger')
    @ApiOperation({ summary: 'Manually trigger reminders for tasks due within 24h (SYS1)' })
    @ApiResponse({ status: 200, description: 'Reminders successfully dispatched.' })
    triggerReminders() {
        return this.tasksService.triggerReminders();
    }

    @Get('set-preferences')
    setPreferences(@Res({ passthrough: true }) res: Response) {
        // Configuración estricta de cookies sin dependencias extra
        res.cookie('theme', 'dark', {
            httpOnly: true, // Inaccesible vía document.cookie (Previene XSS)
            secure: process.env.NODE_ENV === 'production', // Solo HTTPS en prod
            sameSite: 'strict', // Previene CSRF
            maxAge: 1000 * 60 * 60 * 24, // 1 día
        });
        return { message: 'Preferences saved securely' };
    }
}