import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LessThanOrEqual, Not } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskCreatedEvent } from './events/task-created.event';
import { TaskUpdatedEvent } from './events/task-updated.event';
import { TaskDeletedEvent } from './events/task-deleted.event';
import { TaskStatus } from './entities/task.entity';
import { TaskReminderEvent } from './events/task-reminder.event';
import { ConfigService } from '@nestjs/config';

/**
 * Core business logic layer for Task management.
 * Orchestrates database persistence and orchestrates domain events
 * for asynchronous processing.
 */
@Injectable()
export class TasksService {
    private readonly logger = new Logger(TasksService.name);
    private eventBridge: EventBridgeClient;

    constructor(
        @InjectRepository(Task)
        private readonly taskRepository: Repository<Task>,
        private readonly configService: ConfigService
    ) {
        this.eventBridge = new EventBridgeClient({ region: configService.get('AWS_REGION') });
    }

    /**
     * Persists a new task and dispatches a creation event.
     *
     * @param createTaskDto - Validated payload for the new task.
     * @returns The newly persisted Task entity.
     */
    async createTask(createTaskDto: CreateTaskDto): Promise<Task> {
        const newTask = this.taskRepository.create(createTaskDto);
        const savedTask = await this.taskRepository.save(newTask);

        this.logger.log(`Task created successfully: ${savedTask.id}`);

        await this.eventBridge.send(new PutEventsCommand({
            Entries: [
                {
                    Source: 'com.ima.tasks', // Quién emite el evento
                    DetailType: 'task.created', // El nombre del evento
                    Detail: JSON.stringify(savedTask), // El payload (la tarea)
                    EventBusName: 'default', // El bus de EventBridge
                },
            ],
        })).then(() => {
            this.logger.log(`[AWS EventBridge] Evento task.created enviado exitosamente.`);
        }).catch((error) => {
            this.logger.error(`[AWS Error] Fallo al enviar task.created a EventBridge:`, error);
        });

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

        this.eventBridge.send(new PutEventsCommand({
            Entries: [
                {
                    Source: 'com.ima.tasks',
                    DetailType: 'task.updated',
                    Detail: JSON.stringify(result),
                    EventBusName: 'default',
                },
            ],
        })).then(() => {
            this.logger.log(`[AWS EventBridge] Evento task.updated enviado exitosamente.`);
        }).catch((error) => {
            this.logger.error(`[AWS Error] Fallo al enviar task.updated a EventBridge:`, error);
        });
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

        this.eventBridge.send(new PutEventsCommand({
            Entries: [
                {
                    Source: 'com.ima.tasks',
                    DetailType: 'task.deleted',
                    Detail: JSON.stringify({ id, timestamp: new Date() }),
                    EventBusName: 'default',
                },
            ],
        })).then(() => {
            this.logger.log(`[AWS EventBridge] Evento task.deleted enviado exitosamente.`);
        }).catch((error) => {
            this.logger.error(`[AWS Error] Fallo al enviar task.deleted a EventBridge:`, error);
        });
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
                dueDate: LessThanOrEqual(tomorrow),
                assigneeId: Not(IsNull()),
            },
        });

        for (const task of tasksDueSoon) {
            if (task.assigneeId) {
                this.eventBridge.send(new PutEventsCommand({
                    Entries: [
                        {
                            Source: 'com.ima.tasks',
                            DetailType: 'task.reminder',
                            Detail: JSON.stringify({ id: task.id, assigneeId: task.assigneeId, title: task.title, dueDate: task.dueDate }),
                            EventBusName: 'default',
                        },
                    ],
                })).then(() => {
                    this.logger.log(`[AWS EventBridge] Evento task.reminder enviado exitosamente.`);
                }).catch((error) => {
                    this.logger.error(`[AWS Error] Fallo al enviar task.reminder a EventBridge:`, error);
                });
            }
        }

        this.logger.log(`Dispatched ${tasksDueSoon.length} task reminders.`);
        return { triggeredCount: tasksDueSoon.length };
    }
}