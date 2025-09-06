#!/usr/bin/env python3
"""
Generate specialized embeddings for blueprint data in documents.
Creates a combined embedding from dimensions, materials, specifications, etc.
"""

import os
import sys
import json
import requests
import time
import openai
from typing import List, Dict, Any, Optional
from datetime import datetime

# Configuration
SEARCH_ENDPOINT = os.environ.get("SEARCH_ENDPOINT", "https://fcssearchservice.search.windows.net")
SEARCH_API_KEY = os.environ.get("SEARCH_API_KEY", "")
SEARCH_INDEX_NAME = "fcs-construction-docs-index-v2"

# Azure OpenAI configuration
AZURE_OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_KEY = os.environ.get("AZURE_OPENAI_KEY", "")
EMBEDDING_MODEL = "text-embedding-ada-002"

# Set up OpenAI client
if AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY:
    openai.api_type = "azure"
    openai.api_base = AZURE_OPENAI_ENDPOINT
    openai.api_key = AZURE_OPENAI_KEY
    openai.api_version = "2023-05-15"
    print(f"Using Azure OpenAI at {AZURE_OPENAI_ENDPOINT}")
else:
    print("WARNING: Azure OpenAI not configured, embeddings will not be generated")

def search_documents(filter_query: str = None, select_fields: str = None, top: int = 1000) -> List[Dict]:
    """Search for documents in the index."""
    url = f"{SEARCH_ENDPOINT}/indexes/{SEARCH_INDEX_NAME}/docs/search?api-version=2023-11-01"
    headers = {
        "api-key": SEARCH_API_KEY,
        "Content-Type": "application/json"
    }
    
    query = {
        "search": "*",
        "top": top,
        "select": select_fields or "id,fileName,client,category,dimensions,materials,specifications,roomNumbers,measurements,drawingScale,sheetNumber,drawingType,standardsCodes,fireRatings,structuralMembers"
    }
    
    if filter_query:
        query["filter"] = filter_query
    
    response = requests.post(url, headers=headers, json=query)
    
    if response.status_code == 200:
        return response.json().get("value", [])
    else:
        print(f"Error searching documents: {response.status_code}")
        return []

def create_blueprint_text(doc: Dict) -> str:
    """Create a comprehensive text representation of blueprint data for embedding."""
    parts = []
    
    # Document identification
    if doc.get("fileName"):
        parts.append(f"Document: {doc['fileName']}")
    if doc.get("sheetNumber"):
        parts.append(f"Sheet: {doc['sheetNumber']}")
    if doc.get("drawingType"):
        parts.append(f"Type: {doc['drawingType']}")
    if doc.get("drawingScale"):
        parts.append(f"Scale: {doc['drawingScale']}")
    
    # Technical specifications
    if doc.get("dimensions"):
        dims = doc["dimensions"][:20]  # Limit to top 20
        if dims:
            parts.append(f"Dimensions: {', '.join(dims)}")
    
    if doc.get("materials"):
        mats = doc["materials"][:30]  # Limit to top 30
        if mats:
            parts.append(f"Materials: {', '.join(mats)}")
    
    if doc.get("specifications"):
        specs = doc["specifications"][:20]
        if specs:
            parts.append(f"Specifications: {', '.join(specs)}")
    
    if doc.get("standardsCodes"):
        codes = doc["standardsCodes"][:15]
        if codes:
            parts.append(f"Standards/Codes: {', '.join(codes)}")
    
    if doc.get("structuralMembers"):
        members = doc["structuralMembers"][:15]
        if members:
            parts.append(f"Structural: {', '.join(members)}")
    
    if doc.get("fireRatings"):
        ratings = doc["fireRatings"][:10]
        if ratings:
            parts.append(f"Fire Ratings: {', '.join(ratings)}")
    
    if doc.get("roomNumbers"):
        rooms = doc["roomNumbers"][:20]
        if rooms:
            parts.append(f"Rooms: {', '.join(rooms)}")
    
    if doc.get("measurements"):
        measures = doc["measurements"][:15]
        if measures:
            parts.append(f"Measurements: {', '.join(measures)}")
    
    # Combine all parts
    text = " | ".join(parts)
    
    # Limit total length (OpenAI has token limits)
    if len(text) > 8000:
        text = text[:8000] + "..."
    
    return text

def generate_embedding(text: str) -> Optional[List[float]]:
    """Generate embedding for the given text using Azure OpenAI."""
    if not text or not AZURE_OPENAI_KEY:
        return None
    
    try:
        response = openai.Embedding.create(
            input=text,
            engine=EMBEDDING_MODEL
        )
        return response["data"][0]["embedding"]
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return None

def update_document_embedding(doc_id: str, embedding: List[float], has_blueprint_data: bool) -> bool:
    """Update a document with blueprint embedding."""
    url = f"{SEARCH_ENDPOINT}/indexes/{SEARCH_INDEX_NAME}/docs/index?api-version=2023-11-01"
    headers = {
        "api-key": SEARCH_API_KEY,
        "Content-Type": "application/json"
    }
    
    doc_update = {
        "value": [{
            "@search.action": "mergeOrUpload",
            "id": doc_id,
            "blueprintVector": embedding
        }]
    }
    
    # Optionally add a flag indicating this document has blueprint data
    if has_blueprint_data:
        doc_update["value"][0]["hasBlueprintData"] = True
    
    response = requests.post(url, headers=headers, json=doc_update)
    
    return response.status_code in [200, 201, 202]

def process_batch(documents: List[Dict], batch_size: int = 10) -> Dict[str, Any]:
    """Process a batch of documents to generate embeddings."""
    results = {
        "processed": 0,
        "updated": 0,
        "skipped": 0,
        "errors": 0
    }
    
    for i in range(0, len(documents), batch_size):
        batch = documents[i:i+batch_size]
        print(f"\nProcessing batch {i//batch_size + 1} ({i+1}-{min(i+batch_size, len(documents))} of {len(documents)})")
        
        for doc in batch:
            doc_id = doc.get("id")
            if not doc_id:
                results["skipped"] += 1
                continue
            
            # Check if document has any blueprint data
            has_data = any([
                doc.get("dimensions"),
                doc.get("materials"),
                doc.get("specifications"),
                doc.get("structuralMembers"),
                doc.get("standardsCodes"),
                doc.get("fireRatings")
            ])
            
            if not has_data:
                print(f"  - {doc.get('fileName', doc_id)}: No blueprint data")
                results["skipped"] += 1
                continue
            
            # Create blueprint text
            blueprint_text = create_blueprint_text(doc)
            
            if not blueprint_text or len(blueprint_text) < 10:
                print(f"  - {doc.get('fileName', doc_id)}: Insufficient text")
                results["skipped"] += 1
                continue
            
            # Generate embedding
            print(f"  - {doc.get('fileName', doc_id)}: Generating embedding...")
            embedding = generate_embedding(blueprint_text)
            
            if embedding:
                # Update document
                if update_document_embedding(doc_id, embedding, True):
                    print(f"    ✓ Updated successfully")
                    results["updated"] += 1
                else:
                    print(f"    ✗ Update failed")
                    results["errors"] += 1
            else:
                print(f"    ✗ Embedding generation failed")
                results["errors"] += 1
            
            results["processed"] += 1
            
            # Rate limiting
            time.sleep(0.5)  # Adjust based on your API limits
    
    return results

def main():
    """Main execution function."""
    print("=" * 60)
    print("BLUEPRINT EMBEDDING GENERATION")
    print("=" * 60)
    
    if not SEARCH_API_KEY:
        print("ERROR: SEARCH_API_KEY environment variable not set")
        sys.exit(1)
    
    if not AZURE_OPENAI_KEY:
        print("ERROR: AZURE_OPENAI_KEY environment variable not set")
        print("Cannot generate embeddings without OpenAI configuration")
        sys.exit(1)
    
    # Search for documents with blueprint data
    print("\n1. Searching for documents with blueprint data...")
    
    # First, get documents that might have blueprint data
    filter_queries = [
        "dimensions/any()",  # Has dimensions
        "materials/any()",   # Has materials
        "specifications/any()",  # Has specifications
        "category eq 'drawings'",  # Drawing category
        "category eq 'blueprints'",  # Blueprint category
    ]
    
    all_documents = []
    seen_ids = set()
    
    for filter_query in filter_queries:
        print(f"   Searching: {filter_query}")
        docs = search_documents(filter_query=filter_query, top=500)
        for doc in docs:
            if doc["id"] not in seen_ids:
                all_documents.append(doc)
                seen_ids.add(doc["id"])
    
    print(f"   Found {len(all_documents)} unique documents with potential blueprint data")
    
    if not all_documents:
        print("\nNo documents found with blueprint data.")
        print("Make sure documents have been processed with the updated BlueprintTakeoffUnified function.")
        return
    
    # Process documents
    print(f"\n2. Processing {len(all_documents)} documents...")
    
    start_time = time.time()
    results = process_batch(all_documents, batch_size=10)
    elapsed = time.time() - start_time
    
    # Summary
    print("\n" + "=" * 60)
    print("BLUEPRINT EMBEDDING GENERATION COMPLETE")
    print("=" * 60)
    print(f"\nResults:")
    print(f"  Processed: {results['processed']}")
    print(f"  Updated: {results['updated']}")
    print(f"  Skipped: {results['skipped']}")
    print(f"  Errors: {results['errors']}")
    print(f"  Time: {elapsed:.1f} seconds")
    
    if results['updated'] > 0:
        print("\n✓ Blueprint embeddings generated successfully!")
        print("\nYou can now search using:")
        print("  - Vector similarity for technical specifications")
        print("  - Semantic search on blueprint data")
        print("  - Faceted filtering on materials, dimensions, etc.")
    
    print("\nNext steps:")
    print("1. Test vector search with blueprint-specific queries")
    print("2. Update front-end to use new search capabilities")
    print("3. Monitor search performance and relevance")

if __name__ == "__main__":
    main()
