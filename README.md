# Event-Driven Task Management System

A NestJS + React task management system built for a Senior Full-Stack assessment.
Implements an event-driven architecture using NestJS `EventEmitter2` as an
in-process event bus locally, designed to map directly to AWS EventBridge in production.

## Part 1: Architecture & System Design

### 1. High-Level AWS Architecture

- **API / Compute:** **AWS ECS (Fargate)** running stateless Node.js containers.
- **Database:** **Amazon RDS (MySQL)**. Selected for strict relational integrity
  between tasks and users, and for its native support for soft deletes via
  nullable `deleted_at` columns.
- **Event Bus:** **Amazon EventBridge**. Replaces the local `EventEmitter2` in
  production. Chosen over SNS direct delivery because EventBridge allows
  content-based routing rules without coupling the API to specific consumers.
- **Background Workers:** **AWS SQS + AWS Lambda**. EventBridge routes events to
  an SQS queue, which triggers a Lambda to process notifications. SQS acts as a
  buffer to absorb traffic spikes and provides at-least-once delivery guarantees.
- **Scheduler Job:** **Amazon EventBridge Scheduler** triggers the reminder
  endpoint on a configurable cron expression (e.g., every hour).
```mermaid
graph TD
    Client([Client / Frontend]) -->|HTTP REST| API[AWS ECS Fargate: NestJS API]

    subgraph Core
        API -->|Read / Write| DB[(Amazon RDS: MySQL)]
    end

    subgraph Event-Driven Side Effects
        API -->|Publishes Events| EB{Amazon EventBridge}
        EB -->|Routes Event| SQS[AWS SQS Queue]
        SQS -->|Triggers| Lambda[AWS Lambda: Notifier]
        Lambda -->|Sends| Email([Email Provider / SES])
    end

    subgraph Scheduled Tasks
        Cron[EventBridge Scheduler] -.->|POST /reminders/trigger| API
    end

    classDef aws fill:#FF9900,stroke:#232F3E,stroke-width:2px,color:black;
    class API,DB,EB,SQS,Lambda,Cron aws;
```

### 2. Event-Driven Flow

The API emits domain events after every successful state mutation.
Locally, `EventEmitter2` acts as an in-process bus. In production,
the publisher would call the EventBridge `PutEvents` API instead.

| Event           | Emitted when                    | Consumers                                              |
| --------------- | ------------------------------- | ------------------------------------------------------ |
| `task.created`  | A task is created and persisted | `NotificationListener` — notifies assignee             |
| `task.updated`  | A task field is modified        | `NotificationListener` — notifies relevant parties     |
| `task.deleted`  | A task is soft-deleted          | `NotificationListener` — notifies assignee and creator |
| `task.reminder` | Reminder job runs               | `NotificationListener` — sends due-date reminder       |

Email delivery is mocked via structured logs (`[EMAIL SENT]`) in the
`NotificationListener`. In production this would be replaced by a
call to AWS SES or a transactional email provider.

### 3. Data Modelling

**Task Entity**

| Field         | Type             | Notes                                 |
| ------------- | ---------------- | ------------------------------------- |
| `id`          | UUID             | Auto-generated primary key            |
| `title`       | varchar          | Required                              |
| `description` | text             | Optional                              |
| `due_date`    | datetime         | Required                              |
| `creator_id`  | UUID             | FK — the user who created the task    |
| `assignee_id` | UUID             | FK — the user the task is assigned to |
| `status`      | enum             | `PENDING` \| `COMPLETED`              |
| `created_at`  | datetime         | Auto-set on insert                    |
| `updated_at`  | datetime         | Auto-set on update                    |
| `deleted_at`  | datetime \| null | Soft delete — null means active       |

**State transitions and invariants**

- `PENDING → COMPLETED` is the only valid forward transition.
- `COMPLETED` tasks are treated as immutable — no further status changes
  are accepted.
- Deletion is logical (soft delete via `deleted_at`). Deleted tasks are
  excluded from all active queries by TypeORM's `@DeleteDateColumn` decorator
  but remain in the database for audit purposes.
- In production, `synchronize: false` would be used with TypeORM migrations
  to manage schema changes safely.

### 4. Scalability & Reliability

**Scalability**
The API is stateless — all state lives in RDS. ECS Fargate tasks can scale
horizontally behind an Application Load Balancer without any coordination overhead.

**Reliability**
- The SQS queue acts as a buffer between the API and the notification Lambda,
  preventing notification failures from affecting API response times.
- A Dead Letter Queue (DLQ) captures messages that fail after the configured
  number of retries, enabling manual inspection and replay.
- The `EventEmitter2` wildcard configuration (`wildcard: true`, `delimiter: '.'`)
  allows a single listener to subscribe to `task.*` if needed, reducing
  boilerplate for future event types.

**Decoupling**
The API never calls the notification logic directly. It only emits a named event
with a typed payload. This means the notification implementation can be changed,
replaced, or scaled independently without touching the core task logic.

### 5. Local Development & Testing Strategy

#### How events are simulated locally

In the local environment, `@nestjs/event-emitter` (backed by `EventEmitter2`)
replaces AWS EventBridge entirely. The `EventEmitterModule` is configured with
`wildcard: true` so event naming mirrors the production EventBridge pattern
(`task.created`, `task.reminder`, etc.). When deploying to AWS, the only required
change is replacing the `eventEmitter.emit(...)` calls with EventBridge
`PutEvents` calls — the rest of the system remains unchanged.

**Where to see events in action**

After starting the system, create a task via the UI or Swagger and watch the
API container logs:
```bash
docker compose logs -f task-api
```

You will see structured output like:
```
[TasksService] Task created successfully: <uuid>
[MockEmailService] [EMAIL SENT] To Assignee <uuid>: You have been assigned to task "..."
```

#### SYS1 — Triggering the reminder job manually

The reminder endpoint allows local testing without waiting for a real scheduler.
It queries for all non-completed tasks due within the next 24 hours and emits
a `task.reminder` event for each one.

**Via Swagger UI:**

1. Open [http://localhost:3000/api/v1/docs](http://localhost:3000/api/v1/docs)
2. Find `POST /api/v1/tasks/reminders/trigger`
3. Execute — the response returns `{ "triggeredCount": N }`

**Via curl:**
```bash
curl -X POST http://localhost:3000/api/v1/tasks/reminders/trigger
```

**Expected log output:**
```
[TasksService] Dispatched N task reminders.
[MockEmailService] [EMAIL SENT] REMINDER for Assignee <uuid>: Task "..." is due soon!
```

#### Testing strategy

Tests are not included in this submission but the strategy is as follows:

**Unit tests (Jest)**
The primary testing target is `TasksService`. Each method would be tested in
isolation by mocking `Repository<Task>` (via `@nestjs/testing` with a custom
provider) and `EventEmitter2`. The key assertions are:
- Events are emitted with the correct event name and typed payload after
  each mutation.
- `NotFoundException` is thrown when a task is not found.
- `triggerReminders()` emits exactly one `task.reminder` event per qualifying task.
  
**Integration Tests:** Testing the event-driven boundaries. Ensuring that when `TasksService.create()` is called, the `TaskCreatedEvent` is properly dispatched and caught by the `NotificationListener`.

**E2E Tests (Supertest/Cypress):** Simulating the full flow: Creating a task via HTTP POST, verifying database insertion, and confirming the payload structure matches the Swagger OpenAPI specifications.

---

## Part 2: Local Setup Instructions

This project is fully containerized. No local Node.js or MySQL installation is required.

### Prerequisites

- Docker and Docker Compose

### Steps

1. Clone this repository and navigate to the root directory.

2. Create the environment file:
```bash
   cp .env.example .env
```

3. Start the full infrastructure (database, API, and web UI):
```bash
   docker compose up --build -d
```

4. Access the applications:

   | Service            | URL                                 |
   | ------------------ | ----------------------------------- |
   | Frontend UI        | http://localhost:5173               |
   | API / Swagger Docs | http://localhost:3000/api/v1/docs   |
   | Health Check       | http://localhost:3000/api/v1/health |

5. To stream API logs (including event output):
```bash
   docker compose logs -f task-api
```