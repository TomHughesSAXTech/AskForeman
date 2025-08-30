# SAXTech Ask Foreman Site

AI-powered construction document management and chat system.

## Components

- **index.html** - Main chat interface for querying construction documents
- **admin.html** - Admin panel for managing clients and documents
- **ForemanAI.png** - Application logo

## Features

- 🤖 AI Chat with construction document search
- 📄 PDF viewer integration
- 📁 Client document management
- 🔍 Azure AI Search integration
- ☁️ Azure Blob Storage for documents
- 🚀 Bulk upload with 15-file limit
- 🗑️ Client and document deletion

## Setup

1. Configure Azure Storage credentials in admin.html
2. **IMPORTANT**: Replace `{{AZURE_FUNCTION_KEY}}` in admin.html line 885 with your actual Azure Function key
3. Set up n8n workflows for document processing
4. Deploy to Azure Static Web Apps

## Production URLs

- Main App: https://askforeman.saxtechnology.com
- Admin Panel: https://askforeman.saxtechnology.com/admin.html

---
© 2025 SAXTech
