import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as eventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as logs from 'aws-cdk-lib/aws-logs';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================================================
    // ASYNCHRONOUS EVENT-DRIVEN INFRASTRUCTURE ONLY
    // Designed for Hybrid Development: Local API -> Cloud Events
    // ========================================================================

    // 1. Event-Driven Backbone (Amazon EventBridge)
    const eventBus = new events.EventBus(this, 'ImaTaskEventsBus', {
      eventBusName: 'ima-task-events',
    });

    // 2. Asynchronous Processing (Amazon SQS)
    const notificationsQueue = new sqs.Queue(this, 'TaskNotificationsQueue', {
      queueName: 'task-notifications-queue',
      visibilityTimeout: cdk.Duration.seconds(60),
    });

    // 3. Routing Rule (Intercept domain events and send to SQS)
    new events.Rule(this, 'RouteTaskEventsRule', {
      eventBus,
      eventPattern: {
        // Filter by the origin application
        source: ['com.ima.tasks'],
        // Filter strictly by the allowed event types
        detailType: [
          'task.created',
          'task.updated',
          'task.deleted',
          'task.reminder'
        ],
      },
      targets: [new targets.SqsQueue(notificationsQueue)],
    });

    // 4. Notification Worker (AWS Lambda)
    const notifierLambda = new lambda.Function(this, 'TaskNotifierService', {
      runtime: lambda.Runtime.NODEJS_20_X,
      logRetention: logs.RetentionDays.ONE_WEEK,
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log("Processing SQS Batch. Total Records: " + event.Records.length);

          const eventHandlers = {
            "task.created": (detail) => {
              console.log("[EMAIL SENT] -> WELCOME! You have been assigned to a new task: " + detail.title);
              // TODO: AWS SES logic would go here
            },
            "task.updated": (detail) => {
              console.log("[EMAIL SENT] -> UPDATE: The task '" + detail.title + "' has been modified.");
              // TODO: AWS SES logic would go here
            },
            "task.deleted": (detail) => {
              console.log("[EMAIL SENT] -> ALERT: The task '" + detail.title + "' was deleted.");
              // TODO: AWS SES logic would go here

            },
            "task.reminder": (detail) => {
              console.log("[EMAIL SENT] -> URGENT REMINDER: Task '" + detail.title + "' is due very soon!");
              // TODO: AWS SES logic would go here
            },
            "default": (type) => {
              console.log("[WARNING] -> Received an unknown event type: " + type);
              // TODO: AWS SES logic would go here
            }
          };

          // 2. Process each message in the SQS batch
          for (const record of event.Records) {
            try {
              // Parse the SQS body which contains the EventBridge JSON
              const ebEvent = JSON.parse(record.body);
              
              const detailType = ebEvent["detail-type"];
              const detail = ebEvent.detail;             

              console.log("--- Routing Event: " + detailType + " ---");
              
              // 3. O(1) Lookup Dispatcher execution
              const handler = eventHandlers[detailType] || eventHandlers["default"];
              
              if (eventHandlers[detailType]) {
                handler(detail);
              } else {
                handler(detailType); 
              }

            } catch (error) {
              console.error("Failed to parse or process record:", error);
            }
          }
          
          return { statusCode: 200, body: 'All notifications processed successfully' };
        };
      `),
      handler: 'index.handler',
    });

    // Connect SQS to trigger the Lambda
    notifierLambda.addEventSource(new eventSources.SqsEventSource(notificationsQueue));

    // Outputs for the terminal
    new cdk.CfnOutput(this, 'EventBusArn', { value: eventBus.eventBusArn });
    new cdk.CfnOutput(this, 'LambdaName', { value: notifierLambda.functionName });
  }
}