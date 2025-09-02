#!/bin/bash

# Deploy Office File Support to Azure Function
# This script updates your Azure Function to support Word, Excel, and PowerPoint files

echo "🚀 Deploying Office file support to Azure Function..."
echo "=================================================="

# Configuration
FUNCTION_APP="SAXTech-DocConverter"
RESOURCE_GROUP="SAXTech-AI"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Checking Azure CLI login...${NC}"
if ! az account show &>/dev/null; then
    echo -e "${RED}Not logged in to Azure. Please run: az login${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Azure CLI authenticated${NC}"

echo -e "${YELLOW}Step 2: Updating Function App settings...${NC}"

# Update the function app to use the latest Python runtime
az functionapp config set \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --linux-fx-version "PYTHON|3.9" \
    --output none

echo -e "${GREEN}✓ Function runtime updated${NC}"

echo -e "${YELLOW}Step 3: Creating deployment package...${NC}"

# Create a temporary directory for deployment
TEMP_DIR=$(mktemp -d)
echo "Using temp directory: $TEMP_DIR"

# Copy the converter and requirements
cp document_converter.py "$TEMP_DIR/"
cp requirements.txt "$TEMP_DIR/"

# Create a simple update script for the function
cat > "$TEMP_DIR/update_function.py" << 'EOF'
"""
Update script to integrate the new document converter
This should be manually integrated into your existing __init__.py
"""

# Add this import at the top of your __init__.py:
from .document_converter import extract_document_text

# Replace the existing PDF extraction line:
# OLD: extracted_text = extract_pdf_text(document_content)
# NEW: extracted_text = extract_document_text(document_content, file_name, mime_type)

# The new converter handles all file types automatically!
EOF

echo -e "${GREEN}✓ Deployment package created${NC}"

echo -e "${YELLOW}Step 4: Instructions for manual deployment...${NC}"

cat << EOF

${GREEN}=== MANUAL DEPLOYMENT STEPS ===${NC}

1. ${YELLOW}Update requirements.txt in Azure Portal:${NC}
   - Go to Azure Portal > Function App > $FUNCTION_APP
   - Navigate to "App files" or "Development Tools" > "App Service Editor"
   - Open requirements.txt
   - Add these lines:
     python-docx>=0.8.11
     openpyxl>=3.0.10
     python-pptx>=0.6.21
     chardet>=5.0.0

2. ${YELLOW}Upload the document converter:${NC}
   - In App Service Editor, create new file: document_converter.py
   - Copy contents from: azure-function-updates/document_converter.py
   - Save the file

3. ${YELLOW}Update your main function (__init__.py):${NC}
   - Add import at top:
     from .document_converter import extract_document_text
   
   - Find the line that extracts PDF text (around line 150-200):
     extracted_text = extract_pdf_text(document_content)
   
   - Replace with:
     extracted_text = extract_document_text(document_content, file_name, mime_type)

4. ${YELLOW}Restart the Function App:${NC}
   az functionapp restart --name $FUNCTION_APP --resource-group $RESOURCE_GROUP

${GREEN}=== AUTOMATED DEPLOYMENT (Alternative) ===${NC}

Run this command to update requirements via Azure CLI:
${YELLOW}
az functionapp config appsettings set \\
    --name $FUNCTION_APP \\
    --resource-group $RESOURCE_GROUP \\
    --settings "SCM_DO_BUILD_DURING_DEPLOYMENT=true"
${NC}

Then deploy using VS Code or Azure Functions Core Tools.

EOF

echo -e "${YELLOW}Step 5: Creating test script...${NC}"

cat > test_office_files.py << 'EOF'
"""
Test script for Office file support
Run this locally to test the converter
"""

from document_converter import extract_document_text
import sys

def test_file(file_path):
    """Test extracting text from a file"""
    with open(file_path, 'rb') as f:
        content = f.read()
    
    text = extract_document_text(content, file_path)
    print(f"Extracted {len(text)} characters from {file_path}")
    print("First 500 characters:")
    print(text[:500])

if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_file(sys.argv[1])
    else:
        print("Usage: python test_office_files.py <file_path>")
EOF

echo -e "${GREEN}✓ Test script created${NC}"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ Office support files ready!${NC}"
echo -e "${GREEN}================================${NC}"

echo ""
echo -e "${YELLOW}Files created:${NC}"
echo "  - document_converter.py (Enhanced converter with Office support)"
echo "  - requirements.txt (Updated dependencies)"
echo "  - test_office_files.py (Local test script)"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Follow the manual deployment steps above"
echo "  2. Test with sample Word, Excel, and PowerPoint files"
echo "  3. Update your frontend to show supported file types"

# Cleanup
rm -rf "$TEMP_DIR"
