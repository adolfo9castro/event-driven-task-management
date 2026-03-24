import { TaskStatus } from '../entities/task.entity';

/**
 * Event payload dispatched when an existing task is modified.
 * Provides the updated state for downstream synchronization.
 */
export class TaskUpdatedEvent {
    constructor(
        public readonly taskId: string,
        public readonly status?: TaskStatus,
        public readonly timestamp: Date = new Date(),
    ) { }
}