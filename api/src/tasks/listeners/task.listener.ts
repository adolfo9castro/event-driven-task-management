import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TaskCreatedEvent } from '../events/task-created.event';

@Injectable()
export class TaskListener {
    private readonly logger = new Logger(TaskListener.name);

    /**
     * Reacts to 'task.created' events asynchronously.
     * This is where you would integrate third-party services (e.g., Email, Analytics)
     * without affecting the main API response time.
     */
    @OnEvent('task.created', { async: true })
    handleTaskCreatedEvent(event: TaskCreatedEvent) {
        this.logger.debug(
            `[EVENT RECEIVED] Async processing started for Task: [${event.taskId}] - "${event.title}"`,
        );
        // Simulate background work
        setTimeout(() => {
            this.logger.log(`[BACKGROUND JOB] Welcome email/notification prepared for task ${event.taskId}`);
        }, 2000);
    }
}