/**
 * Event payload dispatched when a new task is successfully persisted.
 * Used to trigger decoupled background processes.
 */
export class TaskCreatedEvent {
    constructor(
        public readonly taskId: string,
        public readonly title: string,
        public readonly timestamp: Date = new Date(),
    ) { }
}