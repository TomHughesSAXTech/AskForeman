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
- 🔐 Secure API key management via environment variables

## Setup

1. Configure Azure Storage credentials in admin.html
2. Set up n8n workflows for document processing
3. Deploy to Azure Static Web Apps
4. **Configure Environment Variable in Azure Portal:**
   - Go to your Azure Static Web App in the Azure Portal
   - Navigate to Configuration → Application Settings
   - Add a new application setting:
     - Name: `AZURE_FUNCTION_KEY`
     - Value: Your Azure Function key for the delete client API
   - Save the configuration
   - The app will now securely fetch this key at runtime

## Production URLs

- Main App: https://askforeman.saxtechnology.com
- Admin Panel: https://askforeman.saxtechnology.com/admin.html

---
© 2025 SAXTech
