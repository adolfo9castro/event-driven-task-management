import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
} from 'typeorm';

export enum TaskStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
}

/**
 * Core Domain Model representing a system task.
 * Designed with soft-delete support to maintain audit integrity 
 * within event-driven architectures.
 */
@Entity('tasks')
export class Task {
    /** Internal unique identifier (UUID v4) for distributed consistency */
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /** Brief summary or name of the task */
    @Column({ type: 'varchar', length: 255 })
    title: string;

    /** Detailed explanation of the requirements */
    @Column({ type: 'text', nullable: true })
    description: string;

    /** Current lifecycle stage of the task */
    @Column({
        type: 'enum',
        enum: TaskStatus,
        default: TaskStatus.PENDING,
    })
    status: TaskStatus;

    /** Expected completion timestamp */
    @Column({ name: 'due_date', type: 'timestamp', nullable: true })
    dueDate: Date;

    @Column({ name: 'reminder_sent', type: 'boolean', default: false })
    reminderSent: boolean;

    /** UUID of the user who created the task */
    @Column({ name: 'creator_id', type: 'uuid' })
    creatorId: string;

    /** UUID of the user assigned to complete the task */
    @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
    assigneeId: string;

    /** Audit: Timestamp of record creation */
    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    /** Audit: Timestamp of the last state transition */
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    /** * Audit: Timestamp of logical deletion. 
     * Records with this set are excluded from standard queries.
     */
    @DeleteDateColumn({ name: 'deleted_at', select: false })
    deletedAt: Date;
}