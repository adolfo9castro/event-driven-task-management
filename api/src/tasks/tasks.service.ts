import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Between, Not } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskCreatedEvent } from './events/task-created.event';
import { TaskUpdatedEvent } from './events/task-updated.event';
import { TaskDeletedEvent } from './events/task-deleted.event';
import { TaskStatus } from './entities/task.entity';
import { TaskReminderEvent } from './events/task-reminder.event';

/**
 * Core business logic layer for Task management.
 * Orchestrates database persistence and orchestrates domain events
 * for asynchronous processing.
 */
@Injectable()
export class TasksService {
    private readonly logger = new Logger(TasksService.name);

    constructor(
        @InjectRepository(Task)
        private readonly taskRepository: Repository<Task>,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * Persists a new task and dispatches a creation event.
     *
     * @param createTaskDto - Validated payload for the new task.
     * @returns The newly persisted Task entity.
     */
    async create(createTaskDto: CreateTaskDto): Promise<Task> {
        const newTask = this.taskRepository.create(createTaskDto);
        const savedTask = await this.taskRepository.save(newTask);

        this.logger.log(`Task created successfully: ${savedTask.id}`);

        this.eventEmitter.emit(
            'task.created',
            new TaskCreatedEvent(savedTask.id, savedTask.title),
        );

        return savedTask;
    }

    /**
     * Retrieves all active tasks, excluding soft-deleted records.
     *
     * @returns An array of active Task entities ordered by creation date.
     */
    async findAll(): Promise<Task[]> {
        this.logger.debug('Fetching all active tasks');
        return this.taskRepository.find({
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Retrieves a single active task by its unique identifier.
     *
     * @param id - The UUID of the target task.
     * @returns The requested Task entity.
     * @throws NotFoundException if the task does not exist or is soft-deleted.
     */
    async findOne(id: string): Promise<Task> {
        const task = await this.taskRepository.findOne({ where: { id } });

        if (!task) {
            this.logger.warn(`Attempted to fetch non-existent task: ${id}`);
            throw new NotFoundException(`Task with ID "${id}" not found`);
        }

        return task;
    }

    /**
     * Applies partial updates to an existing task and dispatches an update event.
     *
     * @param id - The UUID of the target task.
     * @param updateTaskDto - Validated payload containing fields to update.
     * @returns The updated Task entity.
     * @throws NotFoundException if the task does not exist.
     */
    async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
        const task = await this.findOne(id);

        const updatedTask = this.taskRepository.merge(task, updateTaskDto);
        const result = await this.taskRepository.save(updatedTask);

        this.logger.log(`Task updated successfully: ${id}`);

        this.eventEmitter.emit(
            'task.updated',
            new TaskUpdatedEvent(result.id, result.status),
        );

        return result;
    }

    /**
     * Performs a logical deletion (soft delete) on a task and dispatches a deletion event.
     * The record remains in the database for audit purposes but is excluded from active queries.
     *
     * @param id - The UUID of the target task.
     * @throws NotFoundException if the task does not exist.
     */
    async remove(id: string): Promise<void> {
        await this.findOne(id);

        await this.taskRepository.softDelete(id);

        this.logger.log(`Task soft-deleted successfully: ${id}`);

        this.eventEmitter.emit(
            'task.deleted',
            new TaskDeletedEvent(id),
        );
    }

    /**
   * Manually triggers reminder events for tasks due within the next 24 hours.
   * Fulfills the SYS1 requirement for local testability.
   *
   * @returns An object containing the number of reminders dispatched.
   */
    async triggerReminders(): Promise<{ triggeredCount: number }> {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24 hours

        const tasksDueSoon = await this.taskRepository.find({
            where: {
                status: Not(TaskStatus.COMPLETED),
                dueDate: Between(now, tomorrow), // Fix: Only future tasks within 24h
                assigneeId: Not(IsNull()),
                reminderSent: false,
            },
            // Fix: Batching to prevent memory overflow in production
            take: 1000,
        });

        if (tasksDueSoon.length === 0) {
            this.logger.log('No pending reminders to dispatch.');
            return { triggeredCount: 0 };
        }

        let dispatchedCount = 0;

        for (const task of tasksDueSoon) {
            try {
                // In AWS this would be EventBridge putEvents
                this.eventEmitter.emit(
                    'task.reminder',
                    new TaskReminderEvent(task.id, task.assigneeId, task.title, task.dueDate),
                );

                // 3. Mark as sent so we don't spam the user on the next cron execution
                await this.taskRepository.update(task.id, { reminderSent: true });
                dispatchedCount++;

            } catch (error) {
                // If one event fails to emit, log it but don't crash the entire batch
                this.logger.error(`Failed to dispatch reminder for task ${task.id}`, error);
            }
        }

        this.logger.log(`Dispatched ${tasksDueSoon.length} task reminders.`);
        return { triggeredCount: tasksDueSoon.length };
    }
}