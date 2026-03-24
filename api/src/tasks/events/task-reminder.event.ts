/**
 * Event payload dispatched when a task is approaching its due date.
 */
export class TaskReminderEvent {
    constructor(
        public readonly taskId: string,
        public readonly assigneeId: string,
        public readonly title: string,
        public readonly dueDate: Date,
    ) { }
}