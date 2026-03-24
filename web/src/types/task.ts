/**
 * Core Domain Model representing a system task in the client.
 */
export interface Task {
    id: string;
    title: string;
    description?: string;
    status: 'PENDING' | 'COMPLETED';
    dueDate?: string;
    creatorId: string;
    assigneeId?: string;
    createdAt: string;
}

/**
 * Data Transfer Object for creating a new task from the UI.
 */
export interface CreateTaskPayload {
    title: string;
    description?: string;
    creatorId: string;
    assigneeId?: string;
    dueDate?: string;
}