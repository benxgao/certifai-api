/**
 * Test scenario for adaptive exam generation
 * This demonstrates how the new feature works
 */

// Example of what happens when creating a new exam:

// 1. User has a previous completed exam with this report:
const previousExamReport = `
Overall Performance: 72% (36/50 questions correct)
Strong Areas: IAM permissions, S3 bucket policies, Lambda functions
Weak Areas: VPC networking, RDS configuration, CloudFormation templates
Recommendations: Focus more on network architecture and infrastructure as code concepts.
`;

// 2. When creating a new exam, the system will:
// - Query for the last exam report
// - Include it in the AI prompt
// - Generate topics that focus on weak areas

// 3. The AI prompt will now include:
const enhancedPrompt = `
Generate a generic list of exam topics for the AWS Solutions Architect Associate certification.

REQUIREMENTS:
1. Create exactly 50 distinct exam topics
2. Topics should come from the exam guide of the AWS Solutions Architect Associate certification
...

ADAPTIVE LEARNING INSIGHTS (use this to focus on areas needing improvement):
Based on the previous exam performance report below, prioritize topics that need strengthening and adjust difficulty for areas of mastery:

Overall Performance: 72% (36/50 questions correct)
Strong Areas: IAM permissions, S3 bucket policies, Lambda functions
Weak Areas: VPC networking, RDS configuration, CloudFormation templates
Recommendations: Focus more on network architecture and infrastructure as code concepts.

Return the response as a JSON array of strings...
`;

// 4. Expected result: More topics related to VPC, RDS, and CloudFormation
// Example generated topics with adaptive learning:
const adaptiveTopics = [
  "VPC Subnets",
  "VPC Routing",
  "VPC Security Groups",
  "VPC NAT Gateways",
  "RDS Multi-AZ",
  "RDS Read Replicas",
  "RDS Security",
  "CloudFormation Stacks",
  "CloudFormation Templates",
  "CloudFormation Drift",
  "IAM Roles", // Still included but less frequent
  "S3 Policies", // Still included but less frequent
  "Lambda Configuration", // Still included but less frequent
  // ... more topics focusing on weak areas
];

// 5. Without adaptive learning, topics would be more generic/balanced:
const standardTopics = [
  "IAM Policies",
  "S3 Buckets",
  "Lambda Functions",
  "EC2 Instances",
  "VPC Networks",
  "RDS Databases",
  "CloudFormation",
  // ... more evenly distributed topics
];

export { previousExamReport, enhancedPrompt, adaptiveTopics, standardTopics };
