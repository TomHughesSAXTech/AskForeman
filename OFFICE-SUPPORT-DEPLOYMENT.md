# 📎 Adding Excel, Word & PowerPoint Support - Quick Guide

## 🚀 **FASTEST DEPLOYMENT (15 minutes)**

### **Step 1: Update Azure Function Requirements**

Go to Azure Portal and add these packages:

1. Navigate to: **Azure Portal** → **SAXTech-DocConverter** 
2. Click: **Development Tools** → **App Service Editor** → **Go**
3. Open: `requirements.txt`
4. Add these lines:
```txt
python-docx>=0.8.11
openpyxl>=3.0.10
python-pptx>=0.6.21
chardet>=5.0.0
```
5. Save the file (Ctrl+S)

### **Step 2: Add the Document Converter**

In the same App Service Editor:

1. Right-click in file explorer → **New File**
2. Name it: `document_converter.py`
3. Copy the entire contents from: `azure-function-updates/document_converter.py`
4. Paste and save

### **Step 3: Update Main Function**

Still in App Service Editor:

1. Open: `__init__.py`
2. At the top (around line 10), add:
```python
from .document_converter import extract_document_text
```

3. Find this line (around line 150-200):
```python
extracted_text = extract_pdf_text(document_content)
```

4. Replace with:
```python
extracted_text = extract_document_text(document_content, file_name, mime_type)
```

5. Save the file

### **Step 4: Restart Function App**

Run in terminal:
```bash
az functionapp restart --name SAXTech-DocConverter --resource-group SAXTech-AI
```

Or in Azure Portal:
- Click **Overview** → **Restart**

## ✅ **WHAT'S NOW SUPPORTED:**

| File Type | Extensions | What Gets Extracted |
|-----------|-----------|-------------------|
| **Word** | .docx, .doc | All paragraphs, tables, headers |
| **Excel** | .xlsx, .xls | All sheets, cells, formulas results |
| **PowerPoint** | .pptx, .ppt | All slides, text boxes, tables |
| **PDF** | .pdf | Already working |
| **Text** | .txt, .md, .csv | Already working |

## 🧪 **TEST IT:**

### Quick Test Files:
1. **Excel:** Upload a budget spreadsheet
2. **Word:** Upload a specification document  
3. **PowerPoint:** Upload a project presentation

### What to Search For:
- Excel: Search for column headers or cell values
- Word: Search for document headings or paragraphs
- PowerPoint: Search for slide titles or bullet points

## 📱 **UPDATE YOUR FRONTEND:**

In `admin.html` and `index.html`, update the file input:

```html
<input type="file" 
       accept=".pdf,.txt,.md,.csv,.docx,.xlsx,.pptx,.doc,.xls,.ppt" 
       multiple />
```

Add a supported files notice:
```html
<div class="supported-files">
  ✅ Supported: PDF, Word, Excel, PowerPoint, Text, CSV
</div>
```

## 🎯 **CONSTRUCTION-SPECIFIC USES:**

### **Excel Files:**
- **Project Budgets** - Search for line items, costs
- **Material Lists** - Find specific materials, quantities
- **Schedule Files** - Search for task names, dates
- **Bid Tabulations** - Find contractor names, prices

### **Word Documents:**
- **Specifications** - Search for section numbers, requirements
- **Contracts** - Find clauses, terms, dates
- **RFIs/Submittals** - Search for item numbers, descriptions
- **Meeting Minutes** - Find action items, decisions

### **PowerPoint:**
- **Project Presentations** - Search for slide content
- **Safety Presentations** - Find safety topics, procedures
- **Progress Reports** - Search for milestones, updates

## ⚠️ **TROUBLESHOOTING:**

### If files aren't processing:
1. Check Function App logs:
```bash
az webapp log tail --name SAXTech-DocConverter --resource-group SAXTech-AI
```

2. Verify packages installed:
- Go to Kudu console: `https://saxtech-docconverter.scm.azurewebsites.net`
- Run: `pip list | grep -E "docx|openpyxl|pptx"`

3. Common issues:
- **"Module not found"** → Restart function app after adding requirements
- **"Unable to extract"** → File might be corrupted or password-protected
- **Timeout** → Large Excel files might need more processing time

## 🎉 **SUCCESS CHECKLIST:**

- [ ] Requirements.txt updated with new packages
- [ ] document_converter.py uploaded to function
- [ ] __init__.py updated to use new converter
- [ ] Function app restarted
- [ ] Test Word file uploaded successfully
- [ ] Test Excel file uploaded successfully
- [ ] Test PowerPoint file uploaded successfully
- [ ] Search returns results from Office files

## 💡 **PRO TIPS:**

1. **Large Excel Files:** Consider splitting into multiple smaller files
2. **Complex Word Docs:** PDFs still work better for complex formatting
3. **Password Protected:** Remove passwords before uploading
4. **Older Formats:** .doc/.xls/.ppt work but .docx/.xlsx/.pptx are better

**That's it! Your system now supports Office files!** 🚀
