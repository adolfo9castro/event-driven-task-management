import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TaskCreatedEvent } from '../events/task-created.event';
import { TaskReminderEvent } from '../events/task-reminder.event';

/**
 * Mocks an external notification service (e.g., AWS SES, SendGrid).
 * Reacts to domain events and "sends" emails via logs.
 */
@Injectable()
export class NotificationListener {
    private readonly logger = new Logger('MockEmailService');

    @OnEvent('task.created', { async: true })
    handleTaskCreated(event: TaskCreatedEvent & { assigneeId?: string }) {
        // In a real scenario, we'd look up the user's email by assigneeId
        this.logger.log(`[EMAIL SENT] To Assignee ${event.taskId}: You have been assigned to task "${event.title}"`);
    }

    @OnEvent('task.reminder', { async: true })
    handleTaskReminder(event: TaskReminderEvent) {
        this.logger.log(`[EMAIL SENT] REMINDER for Assignee ${event.assigneeId}: Task "${event.title}" is due soon!`);
    }
}