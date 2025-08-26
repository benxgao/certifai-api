# Topic Tree Data Structure Documentation

## Overview

The topic tree is a hierarchical knowledge structure for certifications that integrates with a public knowledge bank. When users register for a certification, a personalized topic tree is created, allowing them to generate and manage summary items within each topic node.

## Connection Between Public and User Topic Trees

**Template Relationship**: The public topic tree (`knowledge_bank`) serves as a template that gets copied to create personalized user topic trees (`user_topic_trees`). Each topic node in the user's tree maintains a reference to its corresponding public topic node through matching IDs.

**Key Connections**:

- public trees/nodes are not maintained by the users but the platform.
- When public templates are upgraded to a new version, legacy user trees cannot be updated, users can generate topic trees that will reflect the latest version.

## Firestore Collections Structure

### 1. Knowledge Bank Collection (`knowledge_bank`)

**Purpose**: Public repository of certification topic trees that serves as templates.

```typescript
interface PublicTopicTree {
  id: string;
  name: string; // "AWS Solutions Architect Associate"
  description?: string;
  version: string; // "2024-v1"
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  rootTopicNode: PublicTopicNode; // Root topic node
}
```

### 2. Topic Nodes Structure

**Nested within knowledge bank and user topic trees**

```typescript
interface PublicTopicNode {
  id: string;
  title: string; // "Compute Services"
  description?: string;
  level: number; // 1-3 (1 = root, 3 = deepest)
  // order: number; // ordering within same level
  parentId?: string; // null for root level
  children: PublicTopicNode[]; // nested child topics
  metadata: {
    examWeight?: number; // percentage of exam coverage
    status: 'active' | 'deprecated';
  };
}
```

### 3. User Topic Trees Collection (`user_topic_trees`)

**Purpose**: Personalized topic trees for each user's certification journey.

```typescript
interface UserTopicTree {
  id: string; // auto-generated document ID
  userId: string; // reference to user
  certId: string; // reference to knowledge bank cert
  certName: string; // denormalized for quick access
  status: 'active' | 'completed' | 'paused';
  progress: {
    totalTopics: number;
    completedTopics: number;
    percentageComplete: number;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastAccessedAt: Timestamp;
  rootTopicNode: UserTopicNode; // Root topic node with user data
}
```

### 4. User Topic Node Structure

**Enhanced topic nodes with user-specific data**

```typescript
interface UserTopicNode {
  id: string; // matches knowledge bank topic ID
  title: string;
  description?: string;
  level: number;
  order: number;
  parentId?: string;
  children: UserTopicNode[];
  metadata: {
    questionIds: string[]; // latest 3 question IDs
    correctnessRate?: number; // percentage of correct answers
  };
  userProgress: {
    status: 'not_started' | 'in_progress' | 'completed';
    completionPercentage: number;
    lastStudied?: Timestamp;
  };
  summaryItemsCount: number; // denormalized count
}
```

### 5. Summary Items Collection (`summary_items`)

**Purpose**: User-generated study materials for each topic node.

```typescript
interface SummaryItem {
  id: string; // auto-generated
  userId: string;
  userTopicTreeId: string; // parent topic tree
  topicNodeId: string; // specific topic node
  title: string;
  content: string; // markdown or rich text
  type: 'note' | 'flashcard' | 'diagram' | 'code_snippet' | 'link' | 'quiz';
  tags: string[];
  isPublic: boolean; // whether to share with community
  metadata: {
    source?: string; // URL or reference
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastReviewedAt?: Timestamp;
}
```

## Example Topic Tree Structure

### AWS Solutions Architect Associate (5-level hierarchy)

```
Level 1: AWS Solutions Architect Associate (Root)
├── Level 2: Compute Services
│   ├── Level 3: EC2
│   │   ├── Level 4: Instance Types
│   │   │   ├── Level 5: General Purpose (t3, m5)
│   │   │   └── Level 5: Compute Optimized (c5)
│   │   └── Level 4: Storage Options
│   │       ├── Level 5: EBS Volume Types
│   │       └── Level 5: Instance Store
│   └── Level 3: Lambda
│       ├── Level 4: Function Configuration
│       └── Level 4: Event Sources
├── Level 2: Storage Services
│   ├── Level 3: S3
│   │   ├── Level 4: Storage Classes
│   │   └── Level 4: Security & Access Control
│   └── Level 3: EFS
└── Level 2: Networking & Content Delivery
    ├── Level 3: VPC
    └── Level 3: CloudFront
```
