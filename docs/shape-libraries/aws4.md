# AWS 4 Shape Library (Draw.io)

Use for AWS architecture diagrams. Represent services as labeled rectangles with appropriate groupings.

## Layout
- Group by region/VPC using swimlane-style rows (type: "swimlane" or rectangle containers)
- Left-to-right: Internet → Load Balancer → Compute → Database → Storage
- Spacing: at least 180px horizontal, 140px vertical between services. Never overlap shapes.

## Colors (hex)
- Compute (EC2, Lambda): #ff9900 (AWS orange)
- Storage (S3, EBS): #569a31 (green)
- Database (RDS, DynamoDB): #527bbb (blue)
- Network (VPC, ELB): #8c4fff (purple)
- Security (IAM, WAF): #232f3e (dark)

## Labels
- EC2, S3, RDS, Lambda, DynamoDB, API Gateway, CloudFront, VPC
- Use short labels. For sub-items (e.g. "EC2 - Web Tier") use rectangles with groupId
