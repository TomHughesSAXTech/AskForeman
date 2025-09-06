#!/usr/bin/env python3
"""
Add project field to the search index and optimize for performance.
"""

import os
import sys
import json
import requests
import time

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
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Error fetching index: {response.status_code}")
            print(response.text)
            return None
    except Exception as e:
        print(f"Exception fetching index: {e}")
        return None

def add_project_fields(index_def):
    """Add project-related fields to the index."""
    
    # Check if fields already exist
    existing_fields = {field['name'] for field in index_def.get('fields', [])}
    fields_to_add = []
    
    # Project name field
    if 'projectName' not in existing_fields:
        fields_to_add.append({
            "name": "projectName",
            "type": "Edm.String",
            "searchable": True,
            "filterable": True,
            "sortable": True,
            "facetable": True,
            "retrievable": True,
            "analyzer": "standard.lucene"
        })
        print("  Adding field: projectName")
    
    # Project ID field
    if 'projectId' not in existing_fields:
        fields_to_add.append({
            "name": "projectId",
            "type": "Edm.String",
            "searchable": False,
            "filterable": True,
            "sortable": True,
            "facetable": True,
            "retrievable": True
        })
        print("  Adding field: projectId")
    
    # Project phase field
    if 'projectPhase' not in existing_fields:
        fields_to_add.append({
            "name": "projectPhase",
            "type": "Edm.String",
            "searchable": True,
            "filterable": True,
            "sortable": True,
            "facetable": True,
            "retrievable": True
        })
        print("  Adding field: projectPhase")
    
    # Document status field
    if 'documentStatus' not in existing_fields:
        fields_to_add.append({
            "name": "documentStatus",
            "type": "Edm.String",
            "searchable": False,
            "filterable": True,
            "sortable": True,
            "facetable": True,
            "retrievable": True
        })
        print("  Adding field: documentStatus")
    
    # Version field
    if 'version' not in existing_fields:
        fields_to_add.append({
            "name": "version",
            "type": "Edm.String",
            "searchable": False,
            "filterable": True,
            "sortable": True,
            "facetable": False,
            "retrievable": True
        })
        print("  Adding field: version")
    
    # Tags field (for flexible categorization)
    if 'tags' not in existing_fields:
        fields_to_add.append({
            "name": "tags",
            "type": "Collection(Edm.String)",
            "searchable": True,
            "filterable": True,
            "sortable": False,
            "facetable": True,
            "retrievable": True
        })
        print("  Adding field: tags")
    
    # Add new fields to the index
    if fields_to_add:
        index_def['fields'].extend(fields_to_add)
        
        # Update semantic configuration to include project name
        if index_def.get('semantic', {}).get('configurations'):
            for config in index_def['semantic']['configurations']:
                if 'prioritizedKeywordsFields' in config.get('prioritizedFields', {}):
                    # Add projectName as a keyword field for semantic search
                    config['prioritizedFields']['prioritizedKeywordsFields'].append({
                        "fieldName": "projectName"
                    })
                    print("  Added projectName to semantic keywords")
    
    return index_def, len(fields_to_add) > 0

def optimize_index_settings(index_def):
    """Optimize index settings for better performance."""
    
    # Ensure proper analyzer settings for text fields
    for field in index_def.get('fields', []):
        if field['name'] == 'content' and field.get('searchable'):
            # Use a more efficient analyzer for large content
            if 'analyzer' not in field:
                field['analyzer'] = 'standard.lucene'
                print("  Optimized analyzer for content field")
    
    # Optimize vector search settings if present
    if 'vectorSearch' in index_def:
        for algo in index_def['vectorSearch'].get('algorithms', []):
            if algo.get('kind') == 'hnsw' and 'hnswParameters' in algo:
                params = algo['hnswParameters']
                # Optimize HNSW parameters for better performance
                if params.get('efSearch', 0) > 200:
                    params['efSearch'] = 200  # Reduce for faster search
                    print(f"  Optimized efSearch to 200 for faster vector search")
    
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

def test_search_performance():
    """Test search performance after updates."""
    url = f"{SEARCH_ENDPOINT}/indexes/{SEARCH_INDEX_NAME}/docs/search?api-version=2023-11-01"
    headers = {
        "api-key": SEARCH_API_KEY,
        "Content-Type": "application/json"
    }
    
    test_queries = [
        {"search": "steel", "top": 5, "select": "id,fileName,projectName"},
        {"search": "*", "filter": "client eq 'Milo'", "top": 5, "select": "id,fileName,projectName"},
        {"search": "construction", "queryType": "semantic", "semanticConfiguration": "construction-semantic-config", "top": 5}
    ]
    
    print("\nTesting search performance:")
    for i, query in enumerate(test_queries, 1):
        start = time.time()
        response = requests.post(url, headers=headers, json=query)
        elapsed = time.time() - start
        
        if response.status_code == 200:
            results = response.json()
            count = len(results.get('value', []))
            print(f"  Query {i}: {elapsed:.3f}s - {count} results")
        else:
            print(f"  Query {i}: Failed - {response.status_code}")

def main():
    # Check for API key
    if not SEARCH_API_KEY:
        print("Error: SEARCH_API_KEY environment variable not set")
        sys.exit(1)
    
    print("Updating search index with project fields and optimizations...")
    print(f"Index: {SEARCH_INDEX_NAME}")
    print()
    
    # Get current index
    print("Step 1: Fetching current index definition...")
    index_def = get_current_index()
    if not index_def:
        print("Failed to fetch index definition")
        sys.exit(1)
    
    # Add project fields
    print("\nStep 2: Adding project-related fields...")
    index_def, fields_added = add_project_fields(index_def)
    
    if not fields_added:
        print("  All project fields already exist")
    
    # Optimize settings
    print("\nStep 3: Optimizing index settings...")
    index_def = optimize_index_settings(index_def)
    
    # Apply the update
    if fields_added:
        print("\nStep 4: Applying index update...")
        if apply_index_update(index_def):
            print("✓ Index updated successfully")
            
            # Wait for index to update
            print("\nWaiting for index to update...")
            time.sleep(5)
        else:
            print("✗ Failed to update index")
            sys.exit(1)
    
    # Test performance
    print("\nStep 5: Testing search performance...")
    test_search_performance()
    
    print("\n=== Update Complete ===")
    print("New fields available:")
    print("  - projectName: For project identification")
    print("  - projectId: For unique project reference")
    print("  - projectPhase: For project stage tracking")
    print("  - documentStatus: For document workflow")
    print("  - version: For document versioning")
    print("  - tags: For flexible categorization")
    print("\nNote: Existing documents will have null values for new fields.")
    print("Update your document upload process to include these fields.")

if __name__ == "__main__":
    main()
