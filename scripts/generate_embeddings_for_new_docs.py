#!/usr/bin/env python3
"""
Generate embeddings for documents in Azure Search that don't have embeddings yet.
This script can be run periodically or triggered after document uploads.
"""

import os
import sys
import json
import requests
from typing import List, Dict, Any
import time
import argparse

# Configuration
AZURE_OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "https://saxtechopenai.openai.azure.com/")
AZURE_OPENAI_KEY = os.environ.get("AZURE_OPENAI_KEY", "")
EMBEDDING_MODEL = "text-embedding-ada-002"
SEARCH_ENDPOINT = "https://fcssearchservice.search.windows.net"
SEARCH_API_KEY = os.environ.get("SEARCH_API_KEY", "")
SEARCH_INDEX_NAME = "fcs-construction-docs-index-v2"

def get_documents(client: str = None, limit: int = 100) -> List[Dict[str, Any]]:
    """Retrieve documents from the search index."""
    search_url = f"{SEARCH_ENDPOINT}/indexes/{SEARCH_INDEX_NAME}/docs"
    
    # Build filter query
    filter_query = None
    if client:
        filter_query = f"client eq '{client}'"
    
    params = {
        "api-version": "2021-04-30-Preview",
        "$select": "id,fileName,client,category,content",
        "$top": limit
    }
    if filter_query:
        params["$filter"] = filter_query
    
    headers = {
        "api-key": SEARCH_API_KEY,
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(search_url, params=params, headers=headers)
        if response.status_code == 200:
            data = response.json()
            documents = data.get("value", [])
            # Note: We can't check contentVector status via API as it's not retrievable
            # So we'll process all documents and update embeddings
            return documents
        else:
            print(f"Error fetching documents: {response.status_code} - {response.text}")
            return []
    except Exception as e:
        print(f"Error querying search index: {e}")
        return []

def generate_embeddings(text: str) -> List[float]:
    """Generate embeddings using Azure OpenAI."""
    if not text:
        return None
    
    # Truncate if too long
    if len(text) > 30000:
        text = text[:30000]
    
    url = f"{AZURE_OPENAI_ENDPOINT}openai/deployments/{EMBEDDING_MODEL}/embeddings?api-version=2023-05-15"
    headers = {
        "Content-Type": "application/json",
        "api-key": AZURE_OPENAI_KEY
    }
    payload = {
        "input": text
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code == 200:
            data = response.json()
            return data["data"][0]["embedding"]
        else:
            print(f"OpenAI API error: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Error generating embeddings: {e}")
        return None

def update_document_with_embeddings(doc_id: str, embeddings: List[float]) -> bool:
    """Update a document in the search index with embeddings."""
    url = f"{SEARCH_ENDPOINT}/indexes/{SEARCH_INDEX_NAME}/docs/index?api-version=2021-04-30-Preview"
    headers = {
        "Content-Type": "application/json",
        "api-key": SEARCH_API_KEY
    }
    
    document = {
        "value": [{
            "@search.action": "merge",
            "id": doc_id,
            "contentVector": embeddings
        }]
    }
    
    try:
        response = requests.post(url, headers=headers, json=document)
        if response.status_code in [200, 201]:
            return True
        else:
            print(f"Failed to update {doc_id}: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"Error updating document {doc_id}: {e}")
        return False

def process_documents(client: str = None, dry_run: bool = False, force: bool = False):
    """Main processing function."""
    # Check for API keys
    if not AZURE_OPENAI_KEY:
        print("Error: AZURE_OPENAI_KEY environment variable not set")
        sys.exit(1)
    if not SEARCH_API_KEY:
        print("Error: SEARCH_API_KEY environment variable not set")
        sys.exit(1)
    
    # Get documents
    print(f"Fetching documents{' for client: ' + client if client else ''}...")
    documents = get_documents(client)
    
    if not documents:
        print("No documents found.")
        return
    
    print(f"Found {len(documents)} documents total.")
    if force:
        print("Force mode: Will regenerate embeddings for all documents.")
    else:
        print("Note: Cannot determine which documents have embeddings via API.")
        print("Will generate embeddings for all documents (existing ones will be updated).")
    
    if dry_run:
        print("\nDry run mode - documents that would be processed:")
        for doc in documents:
            print(f"  - {doc.get('fileName', 'Unknown')} (Client: {doc.get('client', 'Unknown')})")
        return
    
    # Process each document
    success_count = 0
    error_count = 0
    
    for i, doc in enumerate(documents, 1):
        doc_id = doc.get("id")
        filename = doc.get("fileName", "Unknown")
        content = doc.get("content", "")
        
        print(f"\n[{i}/{len(documents)}] Processing: {filename}")
        
        if not content:
            print(f"  ⚠ No content found, skipping")
            continue
        
        # Generate embeddings
        print(f"  Generating embeddings for {len(content)} characters...")
        embeddings = generate_embeddings(content)
        
        if embeddings:
            # Update document
            if update_document_with_embeddings(doc_id, embeddings):
                print(f"  ✓ Successfully updated with {len(embeddings)} dimensional embedding")
                success_count += 1
            else:
                print(f"  ✗ Failed to update document")
                error_count += 1
        else:
            print(f"  ✗ Failed to generate embeddings")
            error_count += 1
        
        # Rate limiting
        time.sleep(0.5)  # Small delay between requests
    
    print(f"\n=== Summary ===")
    print(f"Successfully processed: {success_count} documents")
    print(f"Failed: {error_count} documents")
    print(f"Total: {len(documents)} documents")

def main():
    parser = argparse.ArgumentParser(description='Generate embeddings for documents in Azure Search')
    parser.add_argument('--client', type=str, help='Process only documents for a specific client')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be processed without making changes')
    parser.add_argument('--force', action='store_true', help='Force regeneration of embeddings for all documents')
    
    args = parser.parse_args()
    
    process_documents(client=args.client, dry_run=args.dry_run, force=args.force)

if __name__ == "__main__":
    main()
