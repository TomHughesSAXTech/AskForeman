# 🔄 **N8N Workflow Update - Azure Function Integration**

## ⚠️ **CRITICAL UPDATE REQUIRED**

Your n8n workflow currently processes documents internally, which causes memory issues with large files. You need to update it to use the Azure Function app instead.

## 🎯 **What Changes:**

### **BEFORE (Current - Problematic):**
- n8n processes documents internally
- Crashes with files > 5-10MB
- Uses Kubernetes pod memory
- Limited processing capabilities

### **AFTER (New - Robust):**
- Azure Function handles all processing
- Supports files up to 100MB
- Runs in Azure cloud infrastructure
- Full OCR, Office, and PDF support

## 📝 **Step-by-Step Update Instructions:**

### **1. Import the New Workflow Section**

I've created a new workflow file: `n8n-azure-function-upload-workflow.json`

This workflow properly:
- Accepts file uploads via webhook
- Sends files to Azure Function for processing
- Handles responses and errors
- Returns processing status

### **2. Update Your Existing Workflow**

In your n8n instance:

1. **Open your workflow editor**
2. **Find the document upload section** 
3. **Replace with these nodes:**

```json
{
  "name": "Azure Function - ConvertDocument",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "parameters": {
    "method": "POST",
    "url": "https://saxtech-docconverter.azurewebsites.net/api/convertdocument",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "x-functions-key",
          "value": "GsqoRnVEcexSaaBTLsQ6NAIw7M_2Qqxg8SdHsYuYuAcBAzFulSx1NA=="
        }
      ]
    },
    "sendBody": true,
    "contentType": "multipart-form-data",
    "bodyParameters": {
      "parameters": [
        {
          "name": "file",
          "value": "={{ $binary.data }}",
          "parameterType": "formBinaryData"
        },
        {
          "name": "client",
          "value": "={{ $json.client }}"
        },
        {
          "name": "category",
          "value": "={{ $json.category }}"
        }
      ]
    },
    "options": {
      "timeout": 120000
    }
  }
}
```

### **3. Key Configuration Details**

**Azure Function Endpoint:**
```
https://saxtech-docconverter.azurewebsites.net/api/convertdocument
```

**Authentication Header:**
```
x-functions-key: GsqoRnVEcexSaaBTLsQ6NAIw7M_2Qqxg8SdHsYuYuAcBAzFulSx1NA==
```

**Required Form Fields:**
- `file` - Binary file data
- `client` - Client name (string)
- `category` - Document category (string)

**Optional Fields:**
- `useOCR` - Set to "true" for scanned documents

## 🧪 **Test Your Integration:**

### **Test with curl:**
```bash
# Test with a sample PDF
curl -X POST https://saxtech-docconverter.azurewebsites.net/api/convertdocument \
  -H "x-functions-key: GsqoRnVEcexSaaBTLsQ6NAIw7M_2Qqxg8SdHsYuYuAcBAzFulSx1NA==" \
  -F "file=@test.pdf" \
  -F "client=TestClient" \
  -F "category=drawings"
```

### **Expected Response:**
```json
{
  "success": true,
  "message": "Document processed successfully",
  "documentId": "abc123...",
  "fileName": "test.pdf",
  "client": "TestClient",
  "category": "drawings",
  "textLength": 5432,
  "chunkCount": 2,
  "blobUrl": "https://..."
}
```

## 🔍 **What the Azure Function Does:**

1. **Receives file** from n8n (up to 100MB)
2. **Extracts text** based on file type:
   - PDF → iText7 or OCR
   - Word/Excel/PowerPoint → OpenXml
   - Text files → Direct read
3. **Generates embeddings** via Azure OpenAI
4. **Chunks large documents** for better search
5. **Indexes in Azure Search** with vectors
6. **Stores original** in blob storage
7. **Returns metadata** to n8n

## ⚡ **Performance Benefits:**

| Metric | Old (n8n Internal) | New (Azure Function) |
|--------|-------------------|---------------------|
| **Max File Size** | ~5-10MB | 100MB |
| **Processing Location** | Kubernetes Pod | Azure Cloud |
| **Memory Usage** | High (crashes) | Minimal |
| **OCR Support** | Limited | Full Document Intelligence |
| **Office Files** | No | Yes (Word, Excel, PPT) |
| **Concurrent Uploads** | Limited | Scalable |
| **Cost** | K8s resources | ~$1/month |

## 🚨 **Important Notes:**

1. **Keep the function key secure** - Store it in n8n credentials
2. **Set timeout to 120 seconds** for large files
3. **Binary data must be sent** as multipart/form-data
4. **Response is JSON** with processing details

## 📊 **Monitoring:**

Check function performance:
```bash
# View recent executions
az monitor activity-log list \
  --resource-group SAXTech-AI \
  --resource-id "/subscriptions/.../Microsoft.Web/sites/SAXTech-DocConverter" \
  --query "[?eventTimestamp > '2024-01-01'].{Time:eventTimestamp, Status:status.value}" \
  -o table

# Check function logs
az webapp log tail \
  --name SAXTech-DocConverter \
  --resource-group SAXTech-AI
```

## ✅ **Verification Checklist:**

- [ ] Updated n8n workflow to call Azure Function
- [ ] Added function key to headers
- [ ] Configured multipart/form-data body
- [ ] Set 120-second timeout
- [ ] Tested with small file
- [ ] Tested with large file (>10MB)
- [ ] Verified search indexing works
- [ ] Confirmed no memory issues

## 🎯 **You're Done When:**

1. **Upload any file size** without crashes
2. **See success responses** from Azure Function
3. **Documents appear** in search index
4. **n8n memory usage** stays low
5. **Processing completes** in < 2 minutes

---

**Need help?** The Azure Function is already deployed and running. You just need to update your n8n workflow to call it instead of processing internally!
