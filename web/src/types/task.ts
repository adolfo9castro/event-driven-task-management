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

export interface CreateTaskPayload {
    title: string;
    description?: string;
    creatorId: string;
    assigneeId?: string;
    dueDate?: string;
}

export interface PaginatedTasks {
    items: Task[];
    total: number;
    page: number;
    lastPage: number;
}