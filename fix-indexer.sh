#!/bin/bash

# Fix Azure Search Indexer Field Mapping Issue
# This script updates the indexer to use metadata_storage_path as the document ID

echo "Fixing Azure Search Indexer field mapping..."

# Get the search service admin key
SEARCH_KEY=$(az search admin-key show --service-name "fcssearchservice" --resource-group "SAXTech-AI" --query "primaryKey" -o tsv)

if [ -z "$SEARCH_KEY" ]; then
    echo "Error: Could not retrieve search service admin key"
    exit 1
fi

# Get current indexer configuration
echo "Fetching current indexer configuration..."
INDEXER_CONFIG=$(curl -s -X GET \
    "https://fcssearchservice.search.windows.net/indexers/fcs-construction-docs-indexer-v2?api-version=2023-11-01" \
    -H "api-key: $SEARCH_KEY")

# Update the field mappings to include id mapping from metadata_storage_path
echo "Updating indexer with corrected field mappings..."
curl -X PUT \
    "https://fcssearchservice.search.windows.net/indexers/fcs-construction-docs-indexer-v2?api-version=2023-11-01" \
    -H "Content-Type: application/json" \
    -H "api-key: $SEARCH_KEY" \
    -d '{
        "name": "fcs-construction-docs-indexer-v2",
        "dataSourceName": "fcs-construction-docs-datasource-v2",
        "targetIndexName": "fcs-construction-docs-index-v2",
        "skillsetName": "fcs-construction-docs-skillset-v2",
        "fieldMappings": [
            {
                "sourceFieldName": "metadata_storage_path",
                "targetFieldName": "id",
                "mappingFunction": {
                    "name": "base64Encode"
                }
            },
            {
                "sourceFieldName": "metadata_storage_name",
                "targetFieldName": "fileName",
                "mappingFunction": {
                    "name": "extractTokenAtPosition",
                    "parameters": {
                        "delimiter": "/",
                        "position": -1
                    }
                }
            },
            {
                "sourceFieldName": "metadata_storage_last_modified",
                "targetFieldName": "uploadedAt"
            },
            {
                "sourceFieldName": "metadata_storage_path",
                "targetFieldName": "blobPath"
            },
            {
                "sourceFieldName": "content",
                "targetFieldName": "content"
            }
        ],
        "outputFieldMappings": [
            {
                "sourceFieldName": "/document/contentVector",
                "targetFieldName": "contentVector"
            }
        ],
        "parameters": {
            "batchSize": 10,
            "maxFailedItems": -1,
            "maxFailedItemsPerBatch": -1,
            "configuration": {
                "dataToExtract": "contentAndMetadata",
                "parsingMode": "default",
                "imageAction": "generateNormalizedImages"
            }
        }
    }'

echo ""
echo "Indexer field mapping updated successfully!"
echo ""
echo "Now resetting and running the indexer..."

# Reset the indexer
curl -X POST \
    "https://fcssearchservice.search.windows.net/indexers/fcs-construction-docs-indexer-v2/reset?api-version=2023-11-01" \
    -H "api-key: $SEARCH_KEY"

echo "Indexer reset complete."

# Run the indexer
curl -X POST \
    "https://fcssearchservice.search.windows.net/indexers/fcs-construction-docs-indexer-v2/run?api-version=2023-11-01" \
    -H "api-key: $SEARCH_KEY"

echo ""
echo "Indexer is now running with the corrected field mappings."
echo "The 'metadata_storage_path' field (base64 encoded) will be used as the document ID."
echo ""
echo "Check indexer status with:"
echo "curl -X GET \"https://fcssearchservice.search.windows.net/indexers/fcs-construction-docs-indexer-v2/status?api-version=2023-11-01\" -H \"api-key: $SEARCH_KEY\" | python3 -m json.tool"
