#!/bin/bash

# Azure Function Integration Test Script
# Tests the ConvertDocument function with various file types

echo "🧪 Azure Function Integration Test"
echo "=================================="

# Configuration
FUNCTION_URL="https://saxtech-docconverter.azurewebsites.net/api/convertdocument"
FUNCTION_KEY="GsqoRnVEcexSaaBTLsQ6NAIw7M_2Qqxg8SdHsYuYuAcBAzFulSx1NA=="
TEST_CLIENT="TestClient"
TEST_CATEGORY="test-uploads"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test file upload
test_upload() {
    local file_path=$1
    local file_name=$(basename "$file_path")
    local use_ocr=${2:-false}
    
    echo -e "\n${YELLOW}Testing: $file_name${NC}"
    echo "File size: $(du -h "$file_path" | cut -f1)"
    
    # Build curl command
    local curl_cmd="curl -X POST '$FUNCTION_URL' \
        -H 'x-functions-key: $FUNCTION_KEY' \
        -F 'file=@$file_path' \
        -F 'client=$TEST_CLIENT' \
        -F 'category=$TEST_CATEGORY'"
    
    if [ "$use_ocr" = "true" ]; then
        curl_cmd="$curl_cmd -F 'useOCR=true'"
        echo "OCR: Enabled"
    fi
    
    # Execute upload
    echo "Uploading..."
    response=$(eval $curl_cmd -s)
    
    # Check response
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Success!${NC}"
        
        # Extract key information
        doc_id=$(echo "$response" | grep -o '"documentId":"[^"]*' | cut -d'"' -f4)
        text_length=$(echo "$response" | grep -o '"textLength":[0-9]*' | cut -d':' -f2)
        chunk_count=$(echo "$response" | grep -o '"chunkCount":[0-9]*' | cut -d':' -f2)
        
        echo "  Document ID: $doc_id"
        echo "  Text extracted: $text_length characters"
        echo "  Chunks created: $chunk_count"
    else
        echo -e "${RED}❌ Failed!${NC}"
        echo "Response: $response"
        return 1
    fi
}

# Create test files if they don't exist
create_test_files() {
    echo "📄 Creating test files..."
    
    # Create a simple text file
    if [ ! -f "test.txt" ]; then
        echo "This is a test document for Azure Function integration.
        It contains multiple lines of text.
        The function should extract this content successfully." > test.txt
        echo "Created: test.txt"
    fi
    
    # Create a CSV file
    if [ ! -f "test.csv" ]; then
        echo "Name,Category,Value
        Item1,drawings,100
        Item2,specs,200
        Item3,estimates,300" > test.csv
        echo "Created: test.csv"
    fi
    
    # Create a markdown file
    if [ ! -f "test.md" ]; then
        echo "# Test Document
        
        ## Section 1
        This is a markdown document.
        
        ## Section 2
        - Item 1
        - Item 2
        - Item 3" > test.md
        echo "Created: test.md"
    fi
}

# Main test execution
main() {
    echo "Starting Azure Function integration tests..."
    echo "Function URL: $FUNCTION_URL"
    echo ""
    
    # Create test files
    create_test_files
    
    # Test 1: Text file
    if [ -f "test.txt" ]; then
        test_upload "test.txt"
    fi
    
    # Test 2: CSV file
    if [ -f "test.csv" ]; then
        test_upload "test.csv"
    fi
    
    # Test 3: Markdown file
    if [ -f "test.md" ]; then
        test_upload "test.md"
    fi
    
    # Test 4: PDF with OCR (if available)
    if [ -f "test.pdf" ]; then
        test_upload "test.pdf" "true"
    else
        echo -e "\n${YELLOW}ℹ️  No test.pdf found. Place a PDF in current directory to test.${NC}"
    fi
    
    # Test 5: Word document (if available)
    if [ -f "test.docx" ]; then
        test_upload "test.docx"
    else
        echo -e "\n${YELLOW}ℹ️  No test.docx found. Place a Word doc in current directory to test.${NC}"
    fi
    
    # Test 6: Large file test (if available)
    if [ -f "large-test.pdf" ]; then
        echo -e "\n${YELLOW}🔥 Testing large file upload...${NC}"
        test_upload "large-test.pdf"
    fi
    
    echo -e "\n${GREEN}✨ Test suite complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Update your n8n workflow to use this Azure Function"
    echo "2. Replace internal processing nodes with HTTP Request node"
    echo "3. Use the function key in x-functions-key header"
    echo "4. Send files as multipart/form-data"
    echo ""
    echo "📚 See N8N-AZURE-FUNCTION-INTEGRATION.md for detailed instructions"
}

# Run main function
main
