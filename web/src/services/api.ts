import type { Task, CreateTaskPayload, PaginatedTasks } from '../types/task';

/**
 * The base URL for the Tasks API, sourced from environment variables.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL;

/**
 * Service layer responsible for handling all network requests to the Task API.
 * Encapsulates fetch logic and provides strict typing for domain entities.
 */
export const TaskService = {
    /**
     * Fetches the collection of active tasks from the backend.
     * Fulfills US2 (List Tasks) requirement.
     * * @returns A promise that resolves to an array of Task objects.
     * @throws Error if the network response is not successful.
     */
    async getTasks(page: number = 1, limit: number = 10): Promise<PaginatedTasks> {
        const response = await fetch(`${API_BASE_URL}/tasks?page=${page}&limit=${limit}`);
        if (!response.ok) throw new Error('Could not retrieve tasks.');
        return response.json();
    },

    /**
     * Persists a new task and triggers the event-driven notification flow.
     * Fulfills US1 (Create Task) and US3 (Assign Task) requirements.
     * * @param payload - The validated data required to initialize a task.
     * @returns The newly created Task object.
     */
    async createTask(payload: CreateTaskPayload): Promise<Task> {
        const response = await fetch(`${API_BASE_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Idempotency-Key': crypto.randomUUID(),
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Task creation failed.');
        }
        return response.json();
    },

    /**
     * Updates the status of an existing task.
     * Fulfills US5 (Complete Task) requirement.
     * * @param id - The unique UUID of the task.
     * @param status - The target status (PENDING or COMPLETED).
     */
    async updateTaskStatus(id: string, status: 'PENDING' | 'COMPLETED'): Promise<Task> {
        const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });

        if (!response.ok) throw new Error('Failed to update task status.');
        return response.json();
    },

    /**
     * Performs a logical deletion (soft delete) of a task.
     * Fulfills US4 (Delete Task) requirement.
     * * @param id - The unique UUID of the task to be removed.
     */
    async deleteTask(id: string): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
            method: 'DELETE',
        });

        if (!response.ok) throw new Error('Failed to delete the task.');
    },

    /**
     * triggers reminder events for tasks that are due within the next 24 hours.
     * @returns An object containing the count of triggered reminders.
     * @throws Error if the reminder trigger request fails.
     */
    async triggerReminders(): Promise<{ triggeredCount: number }> {
        const response = await fetch(`${API_BASE_URL}/tasks/reminders/trigger`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to trigger reminders.');
        return response.json();
    },
};