#!/usr/bin/env python3
import requests
import json

# Configuration
SEARCH_SERVICE = "fcssearchservice"
INDEX_NAME = "fcs-construction-docs-index-v2"
API_KEY = "UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv"
API_VERSION = "2023-11-01"

print("Azure Search Index Clear Script")
print("=" * 40)

# First, get all document IDs
search_url = f"https://{SEARCH_SERVICE}.search.windows.net/indexes/{INDEX_NAME}/docs/search?api-version={API_VERSION}"
headers = {
    "Content-Type": "application/json",
    "api-key": API_KEY
}

# Search for all documents
search_payload = {
    "search": "*",
    "select": "id",
    "top": 1000
}

print("Fetching all document IDs...")
response = requests.post(search_url, headers=headers, json=search_payload)
data = response.json()

doc_count = data.get("@odata.count", 0)
documents = data.get("value", [])

print(f"Found {doc_count} documents in the index")

if len(documents) > 0:
    # Create delete operations in batches
    batch_size = 200
    delete_url = f"https://{SEARCH_SERVICE}.search.windows.net/indexes/{INDEX_NAME}/docs/index?api-version={API_VERSION}"
    
    for i in range(0, len(documents), batch_size):
        batch = documents[i:i+batch_size]
        
        # Create delete batch
        delete_batch = {
            "value": [
                {"@search.action": "delete", "id": doc["id"]} 
                for doc in batch
            ]
        }
        
        print(f"Deleting batch {i//batch_size + 1} ({len(batch)} documents)...")
        
        # Execute delete
        delete_response = requests.post(delete_url, headers=headers, json=delete_batch)
        
        if delete_response.status_code in [200, 201]:
            result = delete_response.json()
            successful = sum(1 for item in result.get("value", []) if item.get("status", False))
            print(f"  ✓ Deleted {successful} documents")
        else:
            print(f"  ✗ Error: {delete_response.status_code}")
    
    print("\n✅ All documents deleted successfully!")
else:
    print("No documents to delete.")

# Verify deletion
print("\nVerifying...")
verify_response = requests.post(search_url, headers=headers, json={"search": "*", "top": 1, "count": True})
remaining = verify_response.json().get("@odata.count", 0)
print(f"Documents remaining: {remaining}")

if remaining == 0:
    print("\n🎉 Index is now completely empty!")
else:
    print(f"\n⚠️ {remaining} documents still remain. You may need to run the script again.")
