# 🔧 Adding Office Support to .NET Azure Function

## ⚠️ **IMPORTANT: Your Function is .NET, not Python**

Your Azure Function `SAXTech-DocConverter` is using **.NET Core** (dotnet-isolated runtime), not Python. Here's how to add Office file support:

## 📦 **Method 1: Update via Azure Portal (Easiest)**

### **Step 1: Access Kudu Console**
1. Go to: https://saxtech-docconverter.scm.azurewebsites.net
2. Login with your Azure credentials
3. Click **Debug console** → **CMD** or **PowerShell**

### **Step 2: Navigate to Function Directory**
```cmd
cd site\wwwroot
dir
```

### **Step 3: Update Project File**
Find and edit your `.csproj` file to add these NuGet packages:

```xml
<PackageReference Include="DocumentFormat.OpenXml" Version="3.0.0" />
<PackageReference Include="ClosedXML" Version="0.102.1" />
```

### **Step 4: Add DocumentConverter.cs**
1. In Kudu, create new file: `DocumentConverter.cs`
2. Copy the C# code from `azure-function-updates/DocumentConverter.cs`
3. Save the file

### **Step 5: Update Your Function Code**
In your main function file, add:

```csharp
// At the top
using SAXTech.DocConverter;

// In your function method
var converter = new DocumentConverter(logger);
string extractedText = await converter.ExtractTextAsync(fileBytes, fileName, mimeType);
```

### **Step 6: Rebuild and Deploy**
```cmd
dotnet build
dotnet publish
```

## 📦 **Method 2: Local Development & Deploy**

### **Step 1: Clone Your Function Locally**
```bash
# Using Azure Functions Core Tools
func azure functionapp fetch-app-settings SAXTech-DocConverter
func azure functionapp download SAXTech-DocConverter
```

### **Step 2: Add NuGet Packages**
```bash
dotnet add package DocumentFormat.OpenXml --version 3.0.0
dotnet add package ClosedXML --version 0.102.1
dotnet add package itext7 --version 8.0.2
```

### **Step 3: Add DocumentConverter.cs**
Copy the file from `azure-function-updates/DocumentConverter.cs` to your project

### **Step 4: Update Your Function**
Modify your main function to use the new converter:

```csharp
public static async Task<IActionResult> Run(
    [HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequest req,
    ILogger log)
{
    // Get file from request
    var formdata = await req.ReadFormAsync();
    var file = req.Form.Files[0];
    
    // Read file content
    using var ms = new MemoryStream();
    await file.CopyToAsync(ms);
    var fileBytes = ms.ToArray();
    
    // Extract text using new converter
    var converter = new DocumentConverter(log);
    var extractedText = await converter.ExtractTextAsync(
        fileBytes, 
        file.FileName, 
        file.ContentType
    );
    
    // Continue with your existing logic...
}
```

### **Step 5: Deploy**
```bash
func azure functionapp publish SAXTech-DocConverter
```

## 🎯 **What Gets Added:**

| File Type | Package Used | What's Extracted |
|-----------|-------------|-----------------|
| **Word (.docx)** | DocumentFormat.OpenXml | Paragraphs, tables, headers |
| **Excel (.xlsx)** | ClosedXML | All sheets, cells, formulas |
| **PowerPoint (.pptx)** | DocumentFormat.OpenXml | Slides, text, tables |
| **PDF** | itext7 | All pages, text |

## 🔍 **Finding Your Existing Code:**

To locate your current function code:

1. **In Kudu Console:**
```cmd
cd site\wwwroot
dir *.cs /s
```

2. **Look for files like:**
- `Function1.cs`
- `HttpTrigger.cs`
- `DocumentProcessor.cs`
- Any `.cs` file with `[FunctionName]` attribute

3. **Check the project file:**
```cmd
type *.csproj
```

## ⚡ **Quick Test After Deployment:**

Test with PowerShell:
```powershell
$uri = "https://saxtech-docconverter.azurewebsites.net/api/YourFunctionName"
$file = Get-Item "test.docx"
$response = Invoke-RestMethod -Uri $uri -Method Post -InFile $file
$response
```

## 🛠️ **Troubleshooting:**

### **If packages won't install:**
- Ensure .NET 6.0 SDK is installed
- Clear NuGet cache: `dotnet nuget locals all --clear`

### **If function times out:**
- Increase timeout in `host.json`:
```json
{
  "functionTimeout": "00:10:00"
}
```

### **If Office files aren't recognized:**
- Check file extension detection in code
- Verify MIME type handling

## 📋 **Verification Checklist:**

- [ ] Located existing function code
- [ ] Added NuGet packages to .csproj
- [ ] Added DocumentConverter.cs
- [ ] Updated function to use converter
- [ ] Deployed to Azure
- [ ] Tested with Word file
- [ ] Tested with Excel file
- [ ] Tested with PowerPoint file

## 💡 **Alternative: Keep Current Setup**

If adding Office support is complex, you can:
1. **Keep using PDFs** (already working)
2. **Have users convert Office files to PDF** before uploading
3. **Use Azure Logic Apps** to auto-convert Office to PDF

This is a valid approach for tomorrow's deadline!
