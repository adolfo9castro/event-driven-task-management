/**
 * Event payload dispatched when a task undergoes a soft deletion.
 * Useful for triggering cleanup jobs or audit logging.
 */
export class TaskDeletedEvent {
    constructor(
        public readonly taskId: string,
        public readonly timestamp: Date = new Date(),
    ) { }
}