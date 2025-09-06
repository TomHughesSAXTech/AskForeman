#!/usr/bin/env python3
"""
Set up semantic configuration for Azure Cognitive Search index.
This enables semantic ranking, captions, and answers.
"""

import os
import sys
import json
import requests

# Configuration
SEARCH_ENDPOINT = "https://fcssearchservice.search.windows.net"
SEARCH_API_KEY = os.environ.get("SEARCH_API_KEY", "")
SEARCH_INDEX_NAME = "fcs-construction-docs-index-v2"

def get_current_index():
    """Get the current index definition."""
    url = f"{SEARCH_ENDPOINT}/indexes/{SEARCH_INDEX_NAME}?api-version=2023-11-01"
    headers = {
        "api-key": SEARCH_API_KEY,
        "Content-Type": "application/json"
    }
    
    print(f"  Fetching from: {url}")
    print(f"  Using API key: {SEARCH_API_KEY[:10]}..." if SEARCH_API_KEY else "  No API key!")
    
    try:
        response = requests.get(url, headers=headers)
        print(f"  Response status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  Index fetched: {data.get('name', 'Unknown')}")
            return data
        else:
            print(f"Error fetching index: {response.status_code}")
            print(response.text)
            return None
    except Exception as e:
        print(f"Exception fetching index: {e}")
        return None

def update_semantic_configuration(index_def):
    """Add semantic configuration to the index."""
    
    # Add semantic configuration
    index_def["semantic"] = {
        "defaultConfiguration": "construction-semantic-config",
        "configurations": [
            {
                "name": "construction-semantic-config",
                "prioritizedFields": {
                    "titleField": {
                        "fieldName": "fileName"
                    },
                    "prioritizedContentFields": [
                        {
                            "fieldName": "content"
                        }
                    ],
                    "prioritizedKeywordsFields": [
                        {
                            "fieldName": "category"
                        },
                        {
                            "fieldName": "client"
                        }
                    ]
                }
            }
        ]
    }
    
    # Keep existing vector search configuration if it exists
    # The index already has vector search configured
    
    # Update the contentVector field to use the vector profile
    for field in index_def.get("fields", []):
        if field["name"] == "contentVector":
            # Only add vector-specific properties that exist in the API version
            # The field should already be configured as Collection(Edm.Single)
            pass  # Vector field is already configured properly
    
    return index_def

def apply_index_update(index_def):
    """Apply the updated index definition."""
    url = f"{SEARCH_ENDPOINT}/indexes/{SEARCH_INDEX_NAME}?api-version=2023-11-01&allowIndexDowntime=false"
    headers = {
        "api-key": SEARCH_API_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    # Use PUT to update the index
    response = requests.put(url, headers=headers, json=index_def)
    
    if response.status_code in [200, 201, 204]:
        return True
    else:
        print(f"Error updating index: {response.status_code}")
        print(response.text)
        return False

def test_semantic_search():
    """Test the semantic search configuration."""
    url = f"{SEARCH_ENDPOINT}/indexes/{SEARCH_INDEX_NAME}/docs/search?api-version=2023-11-01"
    headers = {
        "api-key": SEARCH_API_KEY,
        "Content-Type": "application/json"
    }
    
    search_body = {
        "search": "structural steel specifications",
        "queryType": "semantic",
        "semanticConfiguration": "construction-semantic-config",
        "captions": "extractive|highlight-true",
        "answers": "extractive|count-3",
        "select": "id,fileName,client,category",
        "top": 5
    }
    
    response = requests.post(url, headers=headers, json=search_body)
    
    if response.status_code == 200:
        results = response.json()
        print("\n✓ Semantic search is working!")
        
        if results.get("@search.answers"):
            print("\nSemantic Answers:")
            for answer in results["@search.answers"]:
                print(f"  - {answer.get('text', '')[:100]}...")
                print(f"    Score: {answer.get('score', 0):.4f}")
        
        if results.get("value"):
            print(f"\nFound {len(results['value'])} results with semantic ranking:")
            for doc in results["value"]:
                print(f"  - {doc['fileName']} (Client: {doc['client']})")
                if doc.get("@search.captions"):
                    caption = doc["@search.captions"][0]
                    print(f"    Caption: {caption.get('text', '')[:100]}...")
                print(f"    Semantic Score: {doc.get('@search.rerankerScore', 0):.4f}")
    else:
        print(f"✗ Semantic search test failed: {response.status_code}")
        print(response.text)

def main():
    # Check for API key
    if not SEARCH_API_KEY:
        print("Error: SEARCH_API_KEY environment variable not set")
        sys.exit(1)
    
    print("Setting up semantic configuration for search index...")
    print(f"Index: {SEARCH_INDEX_NAME}")
    print(f"Endpoint: {SEARCH_ENDPOINT}")
    print(f"API Key present: {bool(SEARCH_API_KEY)}")
    print()
    
    # Get current index
    print("Step 1: Fetching current index definition...")
    index_def = get_current_index()
    print(f"  Index def type: {type(index_def)}")
    print(f"  Index def is None: {index_def is None}")
    
    if index_def is None:
        print("Failed to fetch index definition")
        sys.exit(1)
    
    # Check if semantic config already exists
    semantic_config = index_def.get("semantic", {})
    if semantic_config and semantic_config.get("configurations"):
        print("✓ Semantic configuration already exists:")
        configs = index_def["semantic"]["configurations"]
        for config in configs:
            print(f"  - {config['name']}")
        print("\nTesting existing configuration...")
        test_semantic_search()
        return
    
    # Update with semantic configuration
    print("Step 2: Adding semantic configuration...")
    updated_index = update_semantic_configuration(index_def)
    
    # Apply the update
    print("Step 3: Applying index update...")
    if apply_index_update(updated_index):
        print("✓ Index updated successfully with semantic configuration")
        
        # Test the semantic search
        print("\nStep 4: Testing semantic search...")
        import time
        time.sleep(5)  # Wait for index to update
        test_semantic_search()
    else:
        print("✗ Failed to update index")
        sys.exit(1)

if __name__ == "__main__":
    main()
