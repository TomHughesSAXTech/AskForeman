#!/usr/bin/env python3
"""
Add blueprint-specific fields to the search index for enhanced OCR extraction data.
This includes dimensions, materials, specifications, and other construction-specific data.
"""

import os
import sys
import json
import requests
import time
import numpy as np
from typing import List, Dict, Any

# Configuration
SEARCH_ENDPOINT = os.environ.get("SEARCH_ENDPOINT", "https://fcssearchservice.search.windows.net")
SEARCH_API_KEY = os.environ.get("SEARCH_API_KEY", "")
SEARCH_INDEX_NAME = "fcs-construction-docs-index-v2"

# Azure OpenAI configuration for embeddings
AZURE_OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_KEY = os.environ.get("AZURE_OPENAI_KEY", "")
EMBEDDING_MODEL = "text-embedding-ada-002"

def get_current_index() -> Dict[str, Any]:
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

def add_blueprint_fields(index_def: Dict[str, Any]) -> tuple[Dict[str, Any], bool]:
    """Add blueprint-specific fields to the index."""
    
    existing_fields = {field['name'] for field in index_def.get('fields', [])}
    fields_to_add = []
    
    # Dimensions field (extracted measurements and sizes)
    if 'dimensions' not in existing_fields:
        fields_to_add.append({
            "name": "dimensions",
            "type": "Collection(Edm.String)",
            "searchable": True,
            "filterable": True,
            "sortable": False,
            "facetable": True,
            "retrievable": True,
            "analyzer": "standard.lucene"
        })
        print("  Adding field: dimensions")
    
    # Materials field (construction materials found in document)
    if 'materials' not in existing_fields:
        fields_to_add.append({
            "name": "materials",
            "type": "Collection(Edm.String)",
            "searchable": True,
            "filterable": True,
            "sortable": False,
            "facetable": True,
            "retrievable": True,
            "analyzer": "standard.lucene"
        })
        print("  Adding field: materials")
    
    # Specifications field (technical specs, standards, codes)
    if 'specifications' not in existing_fields:
        fields_to_add.append({
            "name": "specifications",
            "type": "Collection(Edm.String)",
            "searchable": True,
            "filterable": True,
            "sortable": False,
            "facetable": True,
            "retrievable": True,
            "analyzer": "standard.lucene"
        })
        print("  Adding field: specifications")
    
    # Room numbers field
    if 'roomNumbers' not in existing_fields:
        fields_to_add.append({
            "name": "roomNumbers",
            "type": "Collection(Edm.String)",
            "searchable": True,
            "filterable": True,
            "sortable": False,
            "facetable": True,
            "retrievable": True
        })
        print("  Adding field: roomNumbers")
    
    # Blueprint measurements field (area calculations, volumes)
    if 'measurements' not in existing_fields:
        fields_to_add.append({
            "name": "measurements",
            "type": "Collection(Edm.String)",
            "searchable": True,
            "filterable": True,
            "sortable": False,
            "facetable": False,
            "retrievable": True
        })
        print("  Adding field: measurements")
    
    # Drawing scale field
    if 'drawingScale' not in existing_fields:
        fields_to_add.append({
            "name": "drawingScale",
            "type": "Edm.String",
            "searchable": True,
            "filterable": True,
            "sortable": True,
            "facetable": True,
            "retrievable": True
        })
        print("  Adding field: drawingScale")
    
    # Sheet number field (for blueprint organization)
    if 'sheetNumber' not in existing_fields:
        fields_to_add.append({
            "name": "sheetNumber",
            "type": "Edm.String",
            "searchable": True,
            "filterable": True,
            "sortable": True,
            "facetable": True,
            "retrievable": True
        })
        print("  Adding field: sheetNumber")
    
    # Drawing type field (architectural, structural, MEP, etc.)
    if 'drawingType' not in existing_fields:
        fields_to_add.append({
            "name": "drawingType",
            "type": "Edm.String",
            "searchable": True,
            "filterable": True,
            "sortable": True,
            "facetable": True,
            "retrievable": True
        })
        print("  Adding field: drawingType")
    
    # Revision field (for tracking drawing versions)
    if 'revision' not in existing_fields:
        fields_to_add.append({
            "name": "revision",
            "type": "Edm.String",
            "searchable": False,
            "filterable": True,
            "sortable": True,
            "facetable": True,
            "retrievable": True
        })
        print("  Adding field: revision")
    
    # Standards and codes field (ASTM, ACI, IBC references)
    if 'standardsCodes' not in existing_fields:
        fields_to_add.append({
            "name": "standardsCodes",
            "type": "Collection(Edm.String)",
            "searchable": True,
            "filterable": True,
            "sortable": False,
            "facetable": True,
            "retrievable": True
        })
        print("  Adding field: standardsCodes")
    
    # Fire ratings field
    if 'fireRatings' not in existing_fields:
        fields_to_add.append({
            "name": "fireRatings",
            "type": "Collection(Edm.String)",
            "searchable": True,
            "filterable": True,
            "sortable": False,
            "facetable": True,
            "retrievable": True
        })
        print("  Adding field: fireRatings")
    
    # Structural members field (beams, columns, etc.)
    if 'structuralMembers' not in existing_fields:
        fields_to_add.append({
            "name": "structuralMembers",
            "type": "Collection(Edm.String)",
            "searchable": True,
            "filterable": True,
            "sortable": False,
            "facetable": True,
            "retrievable": True
        })
        print("  Adding field: structuralMembers")
    
    # OCR confidence score field
    if 'ocrConfidence' not in existing_fields:
        fields_to_add.append({
            "name": "ocrConfidence",
            "type": "Edm.Double",
            "searchable": False,
            "filterable": True,
            "sortable": True,
            "facetable": False,
            "retrievable": True
        })
        print("  Adding field: ocrConfidence")
    
    # Has handwritten text field
    if 'hasHandwrittenText' not in existing_fields:
        fields_to_add.append({
            "name": "hasHandwrittenText",
            "type": "Edm.Boolean",
            "searchable": False,
            "filterable": True,
            "sortable": True,
            "facetable": True,
            "retrievable": True
        })
        print("  Adding field: hasHandwrittenText")
    
    # Blueprint metadata vector field (for semantic search on technical data)
    if 'blueprintVector' not in existing_fields:
        fields_to_add.append({
            "name": "blueprintVector",
            "type": "Collection(Edm.Single)",
            "searchable": True,
            "filterable": False,
            "sortable": False,
            "facetable": False,
            "retrievable": False,
            "dimensions": 1536,
            "vectorSearchProfile": "construction-vector-profile"
        })
        print("  Adding field: blueprintVector")
    
    # Add new fields to the index
    if fields_to_add:
        index_def['fields'].extend(fields_to_add)
        modified = True
    else:
        modified = False
    
    return index_def, modified

def update_semantic_configuration(index_def: Dict[str, Any]) -> Dict[str, Any]:
    """Update semantic configuration to include blueprint fields."""
    
    if 'semantic' not in index_def:
        index_def['semantic'] = {
            "configurations": []
        }
    
    # Find or create the construction semantic config
    config = None
    for cfg in index_def['semantic']['configurations']:
        if cfg['name'] == 'construction-semantic-config':
            config = cfg
            break
    
    if not config:
        config = {
            "name": "construction-semantic-config",
            "prioritizedFields": {
                "prioritizedContentFields": [],
                "prioritizedKeywordsFields": []
            }
        }
        index_def['semantic']['configurations'].append(config)
        print("  Created new semantic configuration: construction-semantic-config")
    
    # Add blueprint fields to semantic search
    keyword_fields = config['prioritizedFields'].get('prioritizedKeywordsFields', [])
    keyword_field_names = {f.get('fieldName') for f in keyword_fields}
    
    blueprint_keyword_fields = [
        "dimensions", "materials", "specifications", "sheetNumber", 
        "drawingType", "standardsCodes", "structuralMembers"
    ]
    
    for field_name in blueprint_keyword_fields:
        if field_name not in keyword_field_names:
            keyword_fields.append({"fieldName": field_name})
            print(f"  Added {field_name} to semantic keywords")
    
    config['prioritizedFields']['prioritizedKeywordsFields'] = keyword_fields
    
    return index_def

def update_vector_search_profile(index_def: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure vector search profile is configured for blueprint vectors."""
    
    if 'vectorSearch' not in index_def:
        index_def['vectorSearch'] = {
            "algorithms": [],
            "profiles": [],
            "vectorizers": []
        }
    
    # Check if construction vector profile exists
    profiles = index_def['vectorSearch'].get('profiles', [])
    has_profile = any(p.get('name') == 'construction-vector-profile' for p in profiles)
    
    if not has_profile:
        # Check for existing algorithm or create one
        algorithms = index_def['vectorSearch'].get('algorithms', [])
        has_algo = any(a.get('name') == 'construction-hnsw' for a in algorithms)
        
        if not has_algo:
            algorithms.append({
                "name": "construction-hnsw",
                "kind": "hnsw",
                "hnswParameters": {
                    "metric": "cosine",
                    "m": 4,
                    "efConstruction": 400,
                    "efSearch": 150
                }
            })
            index_def['vectorSearch']['algorithms'] = algorithms
            print("  Added construction-hnsw algorithm")
        
        # Add the profile
        profiles.append({
            "name": "construction-vector-profile",
            "algorithm": "construction-hnsw"
        })
        index_def['vectorSearch']['profiles'] = profiles
        print("  Added construction-vector-profile")
    
    return index_def

def create_suggesters(index_def: Dict[str, Any]) -> Dict[str, Any]:
    """Add suggesters for blueprint-specific fields."""
    
    if 'suggesters' not in index_def:
        index_def['suggesters'] = []
    
    existing_suggesters = {s.get('name') for s in index_def['suggesters']}
    
    if 'blueprint-suggester' not in existing_suggesters:
        index_def['suggesters'].append({
            "name": "blueprint-suggester",
            "searchMode": "analyzingInfixMatching",
            "sourceFields": ["materials", "specifications", "drawingType", "sheetNumber"]
        })
        print("  Added blueprint-suggester for autocomplete")
    
    return index_def

def apply_index_update(index_def: Dict[str, Any]) -> bool:
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

def test_blueprint_search():
    """Test search with blueprint-specific queries."""
    url = f"{SEARCH_ENDPOINT}/indexes/{SEARCH_INDEX_NAME}/docs/search?api-version=2023-11-01"
    headers = {
        "api-key": SEARCH_API_KEY,
        "Content-Type": "application/json"
    }
    
    test_queries = [
        {
            "search": "W12x26 steel beam",
            "searchFields": "materials,specifications,structuralMembers",
            "top": 5,
            "select": "id,fileName,materials,specifications"
        },
        {
            "search": "*",
            "filter": "materials/any(m: m eq 'steel')",
            "top": 5,
            "select": "id,fileName,materials"
        },
        {
            "search": "2-hr fire rating",
            "searchFields": "fireRatings,specifications",
            "top": 5,
            "select": "id,fileName,fireRatings,specifications"
        },
        {
            "search": "*",
            "filter": "hasHandwrittenText eq true",
            "top": 5,
            "select": "id,fileName,ocrConfidence"
        },
        {
            "search": "ASTM A615",
            "searchFields": "standardsCodes,specifications",
            "top": 5,
            "select": "id,fileName,standardsCodes"
        },
        {
            "search": "room 101",
            "searchFields": "roomNumbers,content",
            "top": 5,
            "select": "id,fileName,roomNumbers"
        }
    ]
    
    print("\nTesting blueprint-specific searches:")
    for i, query in enumerate(test_queries, 1):
        print(f"\nTest {i}: {query.get('search', 'Filter query')}")
        start = time.time()
        response = requests.post(url, headers=headers, json=query)
        elapsed = time.time() - start
        
        if response.status_code == 200:
            result = response.json()
            print(f"  ✓ Found {len(result.get('value', []))} results in {elapsed:.3f}s")
            if result.get('value'):
                doc = result['value'][0]
                print(f"  Sample: {doc.get('fileName', 'N/A')}")
        else:
            print(f"  ✗ Error: {response.status_code}")

def main():
    """Main execution function."""
    print("=" * 60)
    print("BLUEPRINT FIELD ENHANCEMENT FOR AZURE COGNITIVE SEARCH")
    print("=" * 60)
    
    if not SEARCH_API_KEY:
        print("ERROR: SEARCH_API_KEY environment variable not set")
        sys.exit(1)
    
    # Get current index
    print("\n1. Fetching current index definition...")
    index_def = get_current_index()
    if not index_def:
        print("ERROR: Could not fetch index definition")
        sys.exit(1)
    
    print(f"   Index: {index_def.get('name')}")
    print(f"   Fields: {len(index_def.get('fields', []))}")
    
    # Add blueprint fields
    print("\n2. Adding blueprint-specific fields...")
    index_def, fields_modified = add_blueprint_fields(index_def)
    
    # Update semantic configuration
    print("\n3. Updating semantic configuration...")
    index_def = update_semantic_configuration(index_def)
    
    # Update vector search profile
    print("\n4. Updating vector search profile...")
    index_def = update_vector_search_profile(index_def)
    
    # Add suggesters
    print("\n5. Adding suggesters for autocomplete...")
    index_def = create_suggesters(index_def)
    
    if fields_modified:
        # Apply updates
        print("\n6. Applying index updates...")
        if apply_index_update(index_def):
            print("   ✓ Index updated successfully!")
            
            # Test the new fields
            print("\n7. Testing blueprint searches...")
            time.sleep(2)  # Give the index time to update
            test_blueprint_search()
        else:
            print("   ✗ Failed to update index")
            sys.exit(1)
    else:
        print("\n✓ All blueprint fields already exist in the index")
        
        # Run tests anyway
        print("\n6. Running blueprint search tests...")
        test_blueprint_search()
    
    print("\n" + "=" * 60)
    print("BLUEPRINT FIELD ENHANCEMENT COMPLETE")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Update the BlueprintTakeoffUnified function to populate these fields")
    print("2. Run the embedding generation script to create blueprint vectors")
    print("3. Re-index existing documents to extract blueprint data")
    print("4. Update front-end search to leverage new fields")

if __name__ == "__main__":
    main()
