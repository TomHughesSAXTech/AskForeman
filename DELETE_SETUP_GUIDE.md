# Delete Client Webhook Setup Guide

## 🎯 What You Need

Just import **`n8n-delete-client-workflow.json`** into your n8n instance.

## 📋 Setup Steps

1. **Import the workflow:**
   - Go to your n8n instance
   - Click "Import from file" 
   - Select `n8n-delete-client-workflow.json`

2. **Activate the workflow:**
   - Toggle the workflow to "Active"
   - The webhook will be available at: `POST /ask-foreman/clients/delete`

3. **Test it:**
   ```bash
   curl -X POST "https://workflows.saxtechnology.com/webhook/ask-foreman/clients/delete" \
   -H "Content-Type: application/json" \
   -d '{"clientId": "test", "clientName": "test"}'
   ```

## 🔧 What It Does

The workflow:
1. **Accepts POST requests** with `clientId` and/or `clientName`
2. **Validates the input** (requires at least one identifier)
3. **Logs the operation** for debugging
4. **Simulates deletion** (you can customize the actual deletion logic)
5. **Returns success response** with details of what was "deleted"

## ⚠️ Customization Needed

The workflow currently **simulates** deletion. To make it actually delete:

### In the "Execute Delete Operations" node, replace the simulation with:

1. **Azure Blob Storage deletion:**
   ```javascript
   // Delete client folder from Azure Blob Storage
   // You'll need to add HTTP Request nodes to call Azure Storage API
   ```

2. **Search index cleanup:**
   ```javascript
   // Remove client documents from search indexes
   // Call your search service API to remove indexed documents
   ```

3. **Database cleanup:**
   ```javascript
   // Remove client records from any databases
   // Call your database APIs to clean up client data
   ```

## 🗑️ Admin Page Workflows Question

**Should you delete admin page workflows?**

**YES**, if you have workflows that are:
- ❌ Not connected to any webhooks
- ❌ Just placeholder/demo workflows  
- ❌ Workflows that say "coming soon" or don't do anything

**KEEP** if you have workflows that:
- ✅ Handle actual webhook endpoints
- ✅ Process real data
- ✅ Are connected to your working endpoints

## 📊 Current Working Endpoints

Based on your setup, keep workflows that handle:
- ✅ `GET /ask-foreman/clients/list` 
- ✅ `POST /ask-foreman/clients/create`
- ✅ Any document upload/processing workflows
- ✅ Chat/AI processing workflows

## 🚀 After Import

Once you import and activate this workflow, your admin panel delete buttons will work immediately - they'll find the endpoint and start using it!

The admin panel will show:
- ✅ **Success messages** when deletion works
- 📊 **Details of what was deleted**
- 🔄 **Automatic refresh** of the client list
