#!/bin/bash

# Test what's in the search index for a specific client
CLIENT="Cooper"
SEARCH_URL="https://fcssearchservice.search.windows.net/indexes/fcs-construction-docs-index-v2/docs/search?api-version=2023-11-01"
API_KEY="UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv"

echo "Searching for all documents for client: $CLIENT"
curl -s -X POST "$SEARCH_URL" \
  -H "api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"search\": \"*\",
    \"filter\": \"client eq '$CLIENT'\",
    \"select\": \"id,fileName,client,category\",
    \"top\": 10
  }" | python3 -m json.tool

echo -e "\n\nNow searching without filter to see all documents:"
curl -s -X POST "$SEARCH_URL" \
  -H "api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"search\": \"*\",
    \"select\": \"id,fileName,client,category\",
    \"top\": 5
  }" | python3 -m json.tool
