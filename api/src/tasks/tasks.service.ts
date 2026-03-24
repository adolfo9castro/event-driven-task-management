import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskCreatedEvent } from './events/task-created.event';

@Injectable()
export class TasksService {
    private readonly logger = new Logger(TasksService.name);

    constructor(
        @InjectRepository(Task)
        private readonly taskRepository: Repository<Task>,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * Persists a new task and dispatches an asynchronous event.
     */
    async create(createTaskDto: CreateTaskDto): Promise<Task> {
        const newTask = this.taskRepository.create(createTaskDto);
        const savedTask = await this.taskRepository.save(newTask);

        this.logger.log(`Task created successfully in DB: ${savedTask.id}`);

        // Fire-and-forget event emission (Non-blocking)
        this.eventEmitter.emit(
            'task.created',
            new TaskCreatedEvent(savedTask.id, savedTask.title),
        );

        return savedTask;
    }
}