#!/bin/bash

# Configuration
SEARCH_ENDPOINT="https://saxtech-search.search.windows.net"
INDEX_NAME="construction-docs-index"
API_KEY="NMptHclb3Lt3LBKS7L7FBNeqPLImGsFuzHqEKzAhZaAzSeA7n7xP"
API_VERSION="2024-07-01"

echo "🔍 Analyzing index for cleanup..."

# Function to search for documents
search_documents() {
    local filter="$1"
    local select="$2"
    
    curl -s -X POST \
        "${SEARCH_ENDPOINT}/indexes/${INDEX_NAME}/docs/search?api-version=${API_VERSION}" \
        -H "Content-Type: application/json" \
        -H "api-key: ${API_KEY}" \
        -d "{
            \"search\": \"*\",
            \"filter\": \"${filter}\",
            \"select\": \"${select}\",
            \"top\": 1000
        }"
}

# Function to delete documents by ID
delete_documents() {
    local doc_ids="$1"
    
    # Build the delete batch
    local delete_batch='{"value":['
    local first=true
    
    while IFS= read -r id; do
        if [ -n "$id" ]; then
            if [ "$first" = false ]; then
                delete_batch+=","
            fi
            delete_batch+="{\"@search.action\":\"delete\",\"id\":\"$id\"}"
            first=false
        fi
    done <<< "$doc_ids"
    
    delete_batch+=']}'
    
    if [ "$delete_batch" != '{"value":[]}' ]; then
        echo "Deleting batch of documents..."
        curl -s -X POST \
            "${SEARCH_ENDPOINT}/indexes/${INDEX_NAME}/docs/index?api-version=${API_VERSION}" \
            -H "Content-Type: application/json" \
            -H "api-key: ${API_KEY}" \
            -d "$delete_batch"
        echo ""
    fi
}

echo "📊 Fetching current index statistics..."

# Get all documents
all_docs=$(search_documents "" "id,client,fileName,category")

# Count total documents
total_count=$(echo "$all_docs" | jq -r '.value | length')
echo "Total documents in index: $total_count"

echo ""
echo "🔍 Identifying problematic documents..."

# 1. Find documents with "Unknown" client
echo "Documents with 'Unknown' client:"
unknown_client_docs=$(echo "$all_docs" | jq -r '.value[] | select(.client == "Unknown" or .client == null or .client == "") | .id')
unknown_count=$(echo "$unknown_client_docs" | grep -c '^' || echo 0)
echo "  Found: $unknown_count documents"

# 2. Find metadata files (shouldn't be indexed)
echo "Metadata files (.metadata.json):"
metadata_docs=$(echo "$all_docs" | jq -r '.value[] | select(.fileName | test("\\.metadata\\.json$")) | .id')
metadata_count=$(echo "$metadata_docs" | grep -c '^' || echo 0)
echo "  Found: $metadata_count documents"

# 3. Find JSONL files (intermediate processing files)
echo "JSONL processing files:"
jsonl_docs=$(echo "$all_docs" | jq -r '.value[] | select(.fileName | test("\\.jsonl$")) | .id')
jsonl_count=$(echo "$jsonl_docs" | grep -c '^' || echo 0)
echo "  Found: $jsonl_count documents"

# 4. Find placeholder files
echo "Placeholder files:"
placeholder_docs=$(echo "$all_docs" | jq -r '.value[] | select(.fileName == ".placeholder") | .id')
placeholder_count=$(echo "$placeholder_docs" | grep -c '^' || echo 0)
echo "  Found: $placeholder_count documents"

# 5. Find files with timestamps in name (duplicates from processing)
echo "Files with processing timestamps:"
timestamp_docs=$(echo "$all_docs" | jq -r '.value[] | select(.fileName | test("_[0-9]{13}\\.pdf")) | .id')
timestamp_count=$(echo "$timestamp_docs" | grep -c '^' || echo 0)
echo "  Found: $timestamp_count documents"

# Calculate total to remove
total_to_remove=$((unknown_count + metadata_count + jsonl_count + placeholder_count + timestamp_count))

echo ""
echo "📋 Summary:"
echo "  Total documents to clean up: $total_to_remove"
echo "  Documents that will remain: $((total_count - total_to_remove))"

if [ $total_to_remove -eq 0 ]; then
    echo ""
    echo "✅ Index is clean! No problematic documents found."
    exit 0
fi

echo ""
read -p "⚠️  Do you want to proceed with cleanup? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "🗑️  Starting cleanup..."

# Delete documents in batches
batch_size=50
all_ids_to_delete=$(cat <<EOF
$unknown_client_docs
$metadata_docs
$jsonl_docs
$placeholder_docs
$timestamp_docs
EOF
)

# Remove empty lines and duplicates
all_ids_to_delete=$(echo "$all_ids_to_delete" | grep -v '^$' | sort -u)

# Process in batches
echo "$all_ids_to_delete" | while IFS= read -r id; do
    if [ -n "$id" ]; then
        echo "$id"
    fi
done | {
    batch=""
    count=0
    batch_num=1
    
    while IFS= read -r id; do
        batch="$batch$id"$'\n'
        ((count++))
        
        if [ $count -ge $batch_size ]; then
            echo "Processing batch $batch_num (${count} documents)..."
            delete_documents "$batch"
            batch=""
            count=0
            ((batch_num++))
            sleep 1  # Rate limiting
        fi
    done
    
    # Process remaining items
    if [ -n "$batch" ]; then
        echo "Processing final batch $batch_num (${count} documents)..."
        delete_documents "$batch"
    fi
}

echo ""
echo "✅ Cleanup completed!"
echo ""
echo "🔄 Verifying cleanup..."

# Wait for index to update
sleep 3

# Get updated count
updated_docs=$(search_documents "" "id")
updated_count=$(echo "$updated_docs" | jq -r '.value | length')

echo "Documents remaining in index: $updated_count"
echo "Documents removed: $((total_count - updated_count))"

echo ""
echo "📋 Final Report:"
echo "  Original document count: $total_count"
echo "  Current document count: $updated_count"
echo "  Success rate: $((100 * (total_count - updated_count) / total_to_remove))%"

echo ""
echo "✅ Index cleanup complete!"
echo ""
echo "💡 To prevent these issues in the future:"
echo "  1. Update the n8n workflow to not index metadata/jsonl files"
echo "  2. Ensure client field is always set properly during upload"
echo "  3. Skip placeholder files during indexing"
