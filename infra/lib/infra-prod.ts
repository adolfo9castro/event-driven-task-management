import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as eventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as path from 'path';

export class InfraStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // ========================================================================
        // BACKEND INFRASTRUCTURE
        // ========================================================================

        // 1. Networking Foundation (VPC)
        const vpc = new ec2.Vpc(this, 'TaskVpc', {
            maxAzs: 2,
            natGateways: 1,
        });

        // 2. Database Layer (MySQL on Amazon RDS)
        const database = new rds.DatabaseInstance(this, 'TaskDatabase', {
            engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0 }),
            vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
            databaseName: 'task_db',
            credentials: rds.Credentials.fromGeneratedSecret('admin'),
            allocatedStorage: 20,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        // 3. Event-Driven Backbone (Amazon EventBridge)
        const eventBus = new events.EventBus(this, 'ImaTaskEventsBus', {
            eventBusName: 'ima-task-events',
        });

        // 4. Compute Layer (AWS Fargate API + Application Load Balancer)
        const cluster = new ecs.Cluster(this, 'TaskCluster', { vpc });

        const apiService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'TaskApiService', {
            cluster,
            memoryLimitMiB: 512,
            cpu: 256,
            taskImageOptions: {
                image: ecs.ContainerImage.fromAsset(path.join(__dirname, '../../api')),
                environment: {
                    DB_HOST: database.dbInstanceEndpointAddress,
                    DB_PORT: database.dbInstanceEndpointPort,
                    DB_NAME: 'task_db',
                    AWS_REGION: this.region,
                },
                secrets: {
                    DB_PASSWORD: ecs.Secret.fromSecretsManager(database.secret!, 'password'),
                    DB_USER: ecs.Secret.fromSecretsManager(database.secret!, 'username'),
                },
                containerPort: 3000,
            },
            publicLoadBalancer: true,
        });

        // Security: Allow API to access the database
        database.connections.allowDefaultPortFrom(apiService.service, 'Allow ECS access');
        // Security: Allow API to publish events to the EventBus
        eventBus.grantPutEventsTo(apiService.taskDefinition.taskRole);

        // 5. Asynchronous Processing (Amazon SQS + AWS Lambda)
        const notificationsQueue = new sqs.Queue(this, 'TaskNotificationsQueue', {
            queueName: 'task-notifications-queue',
            visibilityTimeout: cdk.Duration.seconds(60),
        });

        new events.Rule(this, 'RouteTaskEventsRule', {
            eventBus,
            eventPattern: { source: ['com.ima.tasks'] },
            targets: [new targets.SqsQueue(notificationsQueue)],
        });

        const notifierLambda = new lambda.Function(this, 'TaskNotifierService', {
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log("SQS Event Received:", JSON.stringify(event, null, 2));
          return { statusCode: 200, body: 'Processed' };
        };
      `),
            handler: 'index.handler',
        });

        notifierLambda.addEventSource(new eventSources.SqsEventSource(notificationsQueue));

        // ========================================================================
        // FRONTEND INFRASTRUCTURE
        // ========================================================================

        const websiteBucket = new s3.Bucket(this, 'TaskWebBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        // 2. Global CDN for fast delivery and HTTPS (Updated to use modern OAC security)
        const distribution = new cloudfront.Distribution(this, 'TaskWebDistribution', {
            defaultBehavior: {
                // MAGIC HAPPENS HERE: Using the new secure Origin Access Control (OAC)
                origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    // Fallback for React Router (Single Page Application)
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                }
            ]
        });

        // MAGIC HAPPENS HERE: Pointing to the local React 'dist' folder
        new s3deploy.BucketDeployment(this, 'DeployWebsite', {
            sources: [s3deploy.Source.asset(path.join(__dirname, '../../web/dist'))],
            destinationBucket: websiteBucket,
            distribution,
            distributionPaths: ['/*'],
        });

        // Outputs for the terminal
        new cdk.CfnOutput(this, 'ApiUrl', { value: apiService.loadBalancer.loadBalancerDnsName });
        new cdk.CfnOutput(this, 'FrontendUrl', { value: distribution.domainName });
    }
}