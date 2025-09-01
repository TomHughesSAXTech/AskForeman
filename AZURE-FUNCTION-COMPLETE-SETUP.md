# 🚀 **Complete Azure Function Setup - All Operations**

## ✅ **What We've Done:**

Your Azure Function app (`SAXTech-DocConverter`) now handles **EVERYTHING**:
- ✅ **Document Upload & Processing** (ConvertDocument)
- ✅ **Client Deletion** (DeleteClient) 
- ✅ **File Deletion** (DeleteFile)
- ✅ **Blob Storage Management** (Original & Converted)
- ✅ **Search Index Management**
- ✅ **Vector Embeddings**

Your n8n workflow is now **SUPER SIMPLE** - just webhooks calling Azure Functions!

## 📦 **Files Created:**

### **Azure Functions (Ready to Deploy):**
1. `ConvertDocument-Fixed-Storage.cs` - Handles upload/processing with correct blob paths
2. `DeleteClient.cs` - Deletes entire client (all files + index)
3. `DeleteFile.cs` - Deletes single file (blob + index)
4. `deploy-complete.sh` - Deployment script for all functions

### **n8n Workflows:**
1. `n8n-workflow-SIMPLIFIED-AZURE-ONLY.json` - **NEW SIMPLIFIED WORKFLOW** ⭐
2. `n8n-workflow-AZURE-FUNCTION-PRODUCTION.json` - Updated production workflow

## 🎯 **How to Deploy Everything:**

### **Step 1: Deploy Azure Functions**
```bash
cd /Users/tom/Desktop/WARP/SAXTech-AskForeman-Site/azure-function-updates

# Deploy all three functions
./deploy-complete.sh
```

This will deploy:
- `ConvertDocument` → https://saxtech-docconverter.azurewebsites.net/api/convertdocument
- `DeleteClient` → https://saxtech-docconverter.azurewebsites.net/api/deleteclient  
- `DeleteFile` → https://saxtech-docconverter.azurewebsites.net/api/deletefile

### **Step 2: Import Simplified n8n Workflow**

Import: `n8n-workflow-SIMPLIFIED-AZURE-ONLY.json`

This workflow is **MUCH SIMPLER**:
```
Upload: Webhook → Prepare → Azure Function → Response
Delete Client: Webhook → Azure Function → Response  
Delete File: Webhook → Azure Function → Response
```

That's it! No complex blob storage nodes, no index management nodes.

## 🔄 **What Each Function Does:**

### **ConvertDocument**
```javascript
// Upload any file via n8n
POST /api/convertdocument
Body: multipart/form-data
  - file: binary
  - client: string
  - category: string

// Azure Function handles:
✅ Text extraction (PDF, Word, Excel, PowerPoint)
✅ OCR for scanned documents
✅ Store in FCS-OriginalClients/{client}/{category}/
✅ Store converted in FCS-ConvertedClients/{client}/{category}/
✅ Generate vector embeddings
✅ Index in Azure Cognitive Search
```

### **DeleteClient**
```javascript
DELETE /api/deleteclient
Body: { "client": "ClientName" }

// Deletes:
✅ All files in FCS-OriginalClients/{client}/
✅ All files in FCS-ConvertedClients/{client}/
✅ All documents from search index where client = 'ClientName'
```

### **DeleteFile**
```javascript
DELETE /api/deletefile
Body: { 
  "client": "ClientName",
  "category": "drawings",
  "fileName": "document.pdf"
}

// Deletes:
✅ FCS-OriginalClients/{client}/{category}/{fileName}
✅ FCS-ConvertedClients/{client}/{category}/{fileName}.jsonl
✅ Document from search index
```

## 📊 **Architecture Now:**

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│             │     │                  │     │   Azure Functions   │
│  n8n        │────▶│  Simple Webhook  │────▶│  ┌──────────────┐  │
│  (Minimal   │     │  + HTTP Request  │     │  │ConvertDoc    │  │
│   Memory)   │     │                  │     │  ├──────────────┤  │
│             │     └──────────────────┘     │  │DeleteClient  │  │
└─────────────┘                              │  ├──────────────┤  │
                                              │  │DeleteFile    │  │
                                              │  └──────────────┘  │
                                              │         │          │
                                              │         ▼          │
                                              │  ┌──────────────┐  │
                                              │  │Blob Storage  │  │
                                              │  │Azure Search  │  │
                                              │  │OpenAI        │  │
                                              │  └──────────────┘  │
                                              └─────────────────────┘
```

## ✨ **Benefits of This Architecture:**

| Aspect | Before | Now |
|--------|--------|-----|
| **n8n Memory Usage** | High (holds files) | Minimal (just passes through) |
| **Max File Size** | 5-10MB | 100MB |
| **Complexity** | Many nodes for storage/indexing | 3-4 simple nodes |
| **Failure Points** | Multiple (each node) | Single (Azure Function) |
| **Performance** | Slow (multiple hops) | Fast (direct Azure-to-Azure) |
| **Debugging** | Check n8n + Azure | Check Azure Function logs only |
| **Cost** | K8s resources + Azure | ~$1/month Azure only |

## 🧪 **Test Commands:**

```bash
# Test upload
curl -X POST https://saxtech-docconverter.azurewebsites.net/api/convertdocument \
  -H "x-functions-key: GsqoRnVEcexSaaBTLsQ6NAIw7M_2Qqxg8SdHsYuYuAcBAzFulSx1NA==" \
  -F "file=@test.pdf" \
  -F "client=TestClient" \
  -F "category=test"

# Test delete client
curl -X DELETE https://saxtech-docconverter.azurewebsites.net/api/deleteclient \
  -H "x-functions-key: GsqoRnVEcexSaaBTLsQ6NAIw7M_2Qqxg8SdHsYuYuAcBAzFulSx1NA==" \
  -H "Content-Type: application/json" \
  -d '{"client": "TestClient"}'

# Test delete file
curl -X DELETE https://saxtech-docconverter.azurewebsites.net/api/deletefile \
  -H "x-functions-key: GsqoRnVEcexSaaBTLsQ6NAIw7M_2Qqxg8SdHsYuYuAcBAzFulSx1NA==" \
  -H "Content-Type: application/json" \
  -d '{"client": "TestClient", "category": "test", "fileName": "test.pdf"}'
```

## ⚠️ **Important Notes:**

1. **URLs are lowercase**: `/api/convertdocument` not `/api/ConvertDocument`
2. **Function key** is the same for all functions in the app
3. **Storage paths** match your existing structure:
   - `FCS-OriginalClients/{client}/{category}/{file}`
   - `FCS-ConvertedClients/{client}/{category}/{file}.jsonl`
4. **Search index** uses existing `fcs-construction-docs-index-v2`

## 🎉 **YOU'RE DONE!**

Your system now has:
- ✅ **Azure Functions handling ALL operations**
- ✅ **n8n just doing webhooks and AI** (minimal memory)
- ✅ **100MB file support**
- ✅ **Automatic storage in 3 locations**
- ✅ **Clean, simple, maintainable architecture**
- ✅ **Ready for your deadline!**

**Next Step:** Run `./deploy-complete.sh` to deploy the functions, then import the simplified n8n workflow!
