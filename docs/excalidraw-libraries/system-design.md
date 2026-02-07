# Excalidraw System Design Library Context

The user has these libraries loaded by default: **Software Architecture**, **Information Architecture**, **System Design Components**, **Software Logos** (drwnio), **Cloud** (AWS/GCP/Azure). Use shapes that match these: microservice boxes, database cylinders, load balancers, cache, queue, server clusters, cloud icons.

## Components (match library shapes)
- **rectangle** – services, APIs, microservices, load balancers, caches, application servers
- **ellipse** – databases (cylinder top), storage, external systems
- **line with points** – hexagons for database icons, custom polygons
- **text** – labels, titles, layer headers (e.g. "Frontend", "Backend", "Data")
- **image** – when icons help (cloud, server, DB) use type "image" with fileId + files map

## Library-inspired shapes
- **Database**: cylinder shape (ellipse top + line body) or hexagon — Relational DB, Document DB, Columnar DB, Graph DB, Object Storage, Cache
- **Server/Compute**: rectangle — Application server, Multi-instance server, Load balancer
- **Cloud**: AWS, GCP, Azure cloud shapes
- **Queue/Message**: horizontal cylinder or rectangle — Kafka, SQS, Pub/Sub
- **DNS, Auth, IAM**: small labeled rectangles

## Grouping
- Use groupIds: "frontend", "backend", "data", "external"
- Place related components in same row or column
- Leave gaps between layers (frontend | backend | data)

## Arrows
- Show data/API flow direction
- Label arrows: "REST", "gRPC", "WebSocket", "Queue", "sync", "Pub/Sub"

## Layout (strict)
- TIERED: Client y≈80, Frontend y≈200, API y≈320, Services y≈440, Data y≈560 — same tier = exact same y
- Horizontal: frontend left, backend center, data right
- Vertical: client top, services middle, storage bottom
- No overlap; 100–150px spacing between shapes
