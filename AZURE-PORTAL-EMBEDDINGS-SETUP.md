# 🚀 Azure Portal - Enable Embeddings Setup Guide

## Quick Setup (5 minutes)

### Step 1: Open Azure Portal
1. Go to: https://portal.azure.com
2. Sign in with your Azure account

### Step 2: Navigate to Your Function App
1. Click on **"Function Apps"** in the left menu (or search for it)
2. Click on **"saxtech-functionapps"**

### Step 3: Configure Application Settings
1. In the left menu, under **Settings**, click **"Configuration"**
2. Click **"+ New application setting"** for each of these:

#### Setting 1: OpenAI Endpoint
- **Name:** `AZURE_OPENAI_ENDPOINT`
- **Value:** `https://saxtechopenai.openai.azure.com/`

#### Setting 2: OpenAI Key
- **Name:** `AZURE_OPENAI_KEY`
- **Value:** `9NjdW7TV9gDnnd6qC4fZiD2Vxyfiuyjy8rMvb18DiXhPet5RvfcHHJQOJ59BHACHVfTw5XJ3w3AAAABACOGPfC5`

#### Setting 3: Deployment Name
- **Name:** `AZURE_OPENAI_DEPLOYMENT_NAME`
- **Value:** `text-embedding-ada-002`

### Step 4: Save and Restart
1. Click **"Save"** at the top of the Configuration page
2. Click **"Continue"** when prompted about restarting
3. Wait for the "Updated successfully" message

### Step 5: Restart Function App
1. Go to **"Overview"** in the left menu
2. Click **"Restart"** button at the top
3. Wait 1-2 minutes for restart to complete

## ✅ Verification Steps

### Test 1: Upload a Test Document
1. Open your site: https://your-site.com
2. Upload any small PDF or text file
3. Note the client name you use

### Test 2: Check Admin Panel
1. Open: https://your-site.com/admin.html
2. Look for your uploaded document
3. Check the **"Vector Info"** column:
   - ✅ **"1536D (Ada-002)"** = Embeddings working!
   - ❌ **"None"** = Embeddings not working yet

### Test 3: Semantic Search Test
Try these searches in your chat:
- Search for **"cooling"** → Should find HVAC documents
- Search for **"heating"** → Should find HVAC documents
- Search for **"air conditioning"** → Should find HVAC documents

## 🔍 Troubleshooting

### If embeddings still show "None":
1. **Check Function Logs:**
   - In Azure Portal → Function App → Functions → ConvertDocumentJson → Monitor
   - Look for errors mentioning "OpenAI" or "embeddings"

2. **Verify Settings Applied:**
   - Go to Configuration again
   - Confirm all 3 settings are present
   - Click "Refresh" if needed

3. **Test Direct Function Call:**
   ```bash
   curl -X POST https://saxtech-functionapps.azurewebsites.net/api/ConvertDocumentJson \
     -H "Content-Type: application/json" \
     -H "x-functions-key: YOUR-FUNCTION-KEY" \
     -d '{"file": "BASE64_CONTENT", "fileName": "test.txt", "client": "test"}'
   ```

4. **Check OpenAI Quota:**
   - Go to your OpenAI resource in Azure Portal
   - Check Usage + Quotas
   - Ensure you have available quota

## 📊 Expected Results After Configuration

### Before (Current State):
- ❌ No Vector dimensions shown
- ❌ Search based on keywords only
- ❌ No semantic understanding

### After (With Embeddings):
- ✅ Shows "1536D (Ada-002)" for new documents
- ✅ Semantic search understands synonyms
- ✅ Better search result ranking
- ✅ Cross-document insights

## 🔄 Re-index Existing Documents

To add embeddings to existing documents:

### Option 1: Via Admin Panel
1. Open admin.html
2. Select documents without vectors
3. Click "Re-index Selected"

### Option 2: Re-upload Documents
1. Download original documents from Azure Storage
2. Re-upload them through the site
3. New embeddings will be generated

## 💡 Quick Test Command

After configuration, test with:
```bash
curl -X POST https://workflows.saxtechnology.com/webhook/ask-foreman/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test embeddings", "client": "general"}'
```

Look for improved semantic understanding in responses.

## ✨ Success Indicators

You'll know it's working when:
1. Admin panel shows vector dimensions
2. Search finds related concepts (not just exact matches)
3. Chat responses are more contextually aware
4. Similar documents are automatically linked

---

**Time Required:** 5-10 minutes
**Difficulty:** Easy (just copy-paste values)
**Impact:** Major improvement in search quality
