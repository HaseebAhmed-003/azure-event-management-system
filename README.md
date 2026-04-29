Readme · MDCopy🎟️ Azure-Powered Smart Event Management System
A full-stack, cloud-native event management platform built with React, Node.js, Prisma, and deployed on Microsoft Azure using both IaaS and PaaS services.

Cloud Computing Project — IBA
Region: UAE North | Resource Group: IBA


📋 Table of Contents

Project Overview
Business Problem
Azure Architecture
Tech Stack
Features
Azure Services Used
Project Structure
Getting Started (Local)
Azure Deployment
Environment Variables
API Endpoints
Azure Function — Auto Ticket
IaaS vs PaaS Mapping
Demo Script
Team


🌐 Project Overview
The Azure-Powered Smart Event Management System is a scalable, cloud-based platform that allows organizers to create and manage events, and users to register, book tickets, and receive automated confirmations — all powered by Microsoft Azure cloud infrastructure.
Instead of traditional on-premise hosting, this system leverages Azure's PaaS and IaaS offerings to achieve auto-scaling, managed databases, serverless automation, and enterprise-grade security.
Live URLs:
ServiceURLFrontendhttps://event-frontend-iba.azurewebsites.netBackend APIhttps://event-backend-iba.azurewebsites.netHealth Checkhttps://event-backend-iba.azurewebsites.net/health

💼 Business Problem
Traditional event management systems suffer from:

❌ Inability to handle high traffic during registrations
❌ Ticket booking failures at peak load
❌ Poor scalability with growing user base
❌ Data security vulnerabilities
❌ Manual ticket verification processes
❌ No automated notifications or confirmations
❌ No backup or disaster recovery
❌ High infrastructure maintenance costs

These problems cause revenue loss, customer dissatisfaction, and operational inefficiency.
✅ Our Azure Solution
By migrating to Azure, we achieve:

Auto-scaling App Service handles traffic spikes automatically
Managed PostgreSQL with built-in backup and high availability
Serverless Azure Functions for zero-maintenance automation
Blob Storage for secure, unlimited file storage
Azure Monitor for real-time performance tracking


🏗️ Azure Architecture
User (Browser)
      │
      ▼
┌─────────────────────┐
│  React Frontend      │  ← Azure App Service (PaaS)
│  event-frontend-iba  │
└─────────┬───────────┘
          │ HTTPS API calls
          ▼
┌─────────────────────┐
│  Node.js Backend     │  ← Azure App Service (PaaS)
│  event-backend-iba   │
└──┬──────┬──────┬────┘
   │      │      │
   ▼      ▼      ▼
┌──────┐ ┌────────────┐ ┌──────────────────┐
│Azure │ │  Azure     │ │  Azure Function  │
│ PG   │ │  Blob      │ │  SendTicketEmail │
│ DB   │ │  Storage   │ │  (Serverless)    │
└──────┘ └────────────┘ └──────────────────┘
                                │
                                ▼
                    Automated Email + QR Ticket
                         to User

─────────────────────────────────────
  Azure Virtual Machine: TestIBA     ← IaaS (Testing / Backup)
  Azure Monitor                      ← Performance & Alerts
─────────────────────────────────────

🛠️ Tech Stack
Frontend
TechnologyPurposeReactUI frameworkReact RouterClient-side routingAxios / FetchAPI communication
Backend
TechnologyPurposeNode.jsRuntimeExpress.jsWeb frameworkPrisma ORMDatabase access layerJWTAuthentication tokensbcryptPassword hashingCORSCross-origin requests
Database
TechnologyPurposePostgreSQLRelational databasePrisma MigrateSchema migrations
Cloud (Azure)
ServicePurposeAzure App ServiceHost frontend & backendAzure Database for PostgreSQLManaged cloud databaseAzure Blob StorageFile and image storageAzure FunctionsServerless automationAzure Virtual MachineIaaS testing environmentAzure MonitorLogging and metrics

✨ Features
For Users

🔐 Register and log in securely
🎫 Browse and search events
📅 Book tickets for events
📧 Receive automated booking confirmation (via Azure Function)
🎟️ View and manage booked tickets
📱 QR code ticket generation

For Organizers

➕ Create and publish events
📊 View bookings dashboard
🖼️ Upload event banners (stored in Azure Blob Storage)
🔔 Get notified when tickets are booked

Cloud Features

⚡ Auto-scaling during high traffic
🔄 Automatic database backups
📈 Real-time performance monitoring
🔒 SSL/TLS encryption on all endpoints
🌍 Globally accessible via Azure CDN-ready infrastructure


☁️ Azure Services Used
1. Azure App Service (PaaS)

What: Hosts both React frontend and Node.js backend
Why: No server management, built-in auto-scaling, CI/CD from GitHub
Resource names: event-backend-iba, event-frontend-iba
Pricing tier: Free F1 (Student)

2. Azure Database for PostgreSQL (PaaS)

What: Managed relational database in the cloud
Why: Automatic backups, high availability, SSL-secured access
Server: event-sql-server-003.postgres.database.azure.com
Database: eventdb

3. Azure Blob Storage (PaaS)

What: Cloud object storage for files
Why: Stores event banners, QR codes, and ticket PDFs securely
Container: event-files
Account: eventstorageba

4. Azure Functions (Serverless PaaS)

What: Event-driven serverless compute
Why: Automatically triggers after every booking to send confirmation
Function: SendTicketEmail
App: event-functions-iba

5. Azure Virtual Machine — TestIBA (IaaS)

What: Full Linux virtual machine
Why: Demonstrates IaaS — full server control for testing and backup
Location: UAE North
OS: Ubuntu

6. Azure Monitor

What: Built-in telemetry and logging
Why: Tracks request rates, response times, errors, and live logs
Features used: Metrics, Log Stream, Alerts


📁 Project Structure
azure-event-management-system/
│
├── event-frontend/                  # React Application
│   ├── public/
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   ├── pages/                   # Page-level components
│   │   ├── config.js                # API base URL config
│   │   └── App.js
│   ├── .env                         # REACT_APP_API_URL
│   └── package.json
│
├── src/                             # Node.js Backend
│   ├── index.js                     # Express app entry point
│   ├── routes/                      # API route handlers
│   ├── middleware/                  # Auth, error handling
│   ├── services/                    # Business logic
│   └── lib/
│       └── azureStorage.js          # Blob Storage helper
│
├── prisma/
│   ├── schema.prisma                # Database schema
│   └── migrations/                  # Migration history
│
├── event-functions/                 # Azure Functions
│   └── SendTicketEmail/
│       └── index.js                 # Auto ticket function
│
├── .env                             # Backend environment variables
├── .gitignore
├── package.json
└── README.md

🚀 Getting Started (Local)
Prerequisites

Node.js v18 or higher
npm v8 or higher
PostgreSQL installed locally
Git

1. Clone the repository
bashgit clone https://github.com/YOUR_USERNAME/event-backend-iba.git
cd event-backend-iba
2. Install backend dependencies
bashnpm install
3. Set up environment variables
Create a .env file in the backend root:
envDATABASE_URL="postgresql://postgres:password@localhost:5432/eventdb"
PORT=8080
NODE_ENV=development
JWT_SECRET=your_local_secret_key
FRONTEND_URL=http://localhost:3000
4. Run database migrations
bashnpx prisma migrate dev
npx prisma generate
5. Start the backend
bashnpm run dev
Backend runs at: http://localhost:8080
6. Set up the frontend
bashcd event-frontend
npm install
Create event-frontend/.env:
envREACT_APP_API_URL=http://localhost:8080
bashnpm start
Frontend runs at: http://localhost:3000

☁️ Azure Deployment
See the full step-by-step guide in Azure-Deployment-Guide.md for complete instructions covering:

Preparing local code for Azure
Pushing to GitHub
Configuring Azure PostgreSQL
Deploying backend App Service
Deploying frontend App Service
Setting up Blob Storage
Deploying Azure Function
Configuring the VM
Setting up Azure Monitor

Quick summary:
bash# 1. Push backend to GitHub
git push origin main

# 2. Azure auto-deploys via GitHub Actions (configured in Deployment Center)

# 3. Run DB migrations against Azure
DATABASE_URL="postgresql://adminuser:Postgres.@event-sql-server-003.postgres.database.azure.com:5432/eventdb?sslmode=require" npx prisma migrate deploy

🔐 Environment Variables
Backend (/.env)
VariableDescriptionExampleDATABASE_URLPostgreSQL connection stringpostgresql://adminuser:Postgres.@...PORTServer port (Azure sets this automatically)8080NODE_ENVEnvironment modeproductionJWT_SECRETSecret key for JWT tokensMySecretKey123FRONTEND_URLAllowed CORS originhttps://event-frontend-iba.azurewebsites.netAZURE_STORAGE_CONNECTION_STRINGBlob Storage connectionDefaultEndpointsProtocol=https;...AZURE_CONTAINER_NAMEBlob container nameevent-filesAZURE_FUNCTION_URLFunction endpointhttps://event-functions-iba.azurewebsites.net/api/...
Frontend (/event-frontend/.env)
VariableDescriptionExampleREACT_APP_API_URLBackend API base URLhttps://event-backend-iba.azurewebsites.net

⚠️ Never commit .env files to GitHub. They are in .gitignore.


📡 API Endpoints
Auth
MethodEndpointDescriptionPOST/api/auth/registerRegister new userPOST/api/auth/loginLogin and get JWT token
Events
MethodEndpointDescriptionGET/api/eventsGet all eventsGET/api/events/:idGet single eventPOST/api/eventsCreate event (organizer)PUT/api/events/:idUpdate event (organizer)DELETE/api/events/:idDelete event (organizer)
Bookings
MethodEndpointDescriptionPOST/api/bookingsBook a ticketGET/api/bookings/myGet user's bookingsDELETE/api/bookings/:idCancel booking
Health
MethodEndpointDescriptionGET/healthServer health check

⚡ Azure Function — Auto Ticket
The SendTicketEmail Azure Function is triggered automatically after every booking.
Trigger
Your backend calls the function via HTTP POST after saving the booking:
javascriptawait axios.post(process.env.AZURE_FUNCTION_URL, {
  userEmail: "user@example.com",
  userName: "Ali Hassan",
  eventName: "Tech Summit 2024",
  eventDate: "2024-12-15",
  ticketId: "TKT-001",
  bookingId: "BKG-123"
});
Function Response
json{
  "success": true,
  "message": "Confirmation processed for user@example.com",
  "ticket": {
    "ticketId": "TKT-001",
    "eventName": "Tech Summit 2024",
    "status": "CONFIRMED",
    "generatedAt": "2024-11-30T10:30:00Z"
  }
}
Monitor Invocations
Azure Portal → Function App → event-functions-iba → SendTicketEmail → Monitor

📊 IaaS vs PaaS Mapping
ComponentServiceTypeReasonBackend hostingAzure App ServicePaaSNo OS management, auto-scaleFrontend hostingAzure App ServicePaaSManaged runtime, CD pipelineDatabaseAzure PostgreSQLPaaSManaged backups, HA built-inFile storageAzure Blob StoragePaaSInfinite scale, no maintenanceAutomationAzure FunctionsPaaSServerless, pay-per-useTesting serverAzure VM (TestIBA)IaaSFull OS control, custom config