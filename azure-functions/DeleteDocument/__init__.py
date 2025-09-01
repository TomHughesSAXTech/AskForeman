import logging
import json
import os
from typing import Dict, List, Any, Optional
from datetime import datetime
import azure.functions as func
from azure.storage.blob import BlobServiceClient, ContainerClient
from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import ResourceNotFoundError

# Configuration
STORAGE_CONNECTION_STRING = os.environ.get('AzureWebJobsStorage')
STORAGE_ACCOUNT_NAME = os.environ.get('AZURE_STORAGE_ACCOUNT_NAME', 'saxtechfcs')
CONTAINER_ORIGINAL = os.environ.get('AZURE_STORAGE_CONTAINER_ORIGINAL', 'fcs-clients')
CONTAINER_CONVERTED = os.environ.get('AZURE_STORAGE_CONTAINER_CONVERTED', 'fcs-clients')

SEARCH_ENDPOINT = os.environ.get('AZURE_SEARCH_ENDPOINT', 'https://saxtechsearch.search.windows.net')
SEARCH_API_KEY = os.environ.get('AZURE_SEARCH_API_KEY')
SEARCH_INDEX_NAME = os.environ.get('AZURE_SEARCH_INDEX_NAME', 'saxtech-foreman-index')

async def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Delete documents or entire client from blob storage and search index.
    
    Parameters:
    - deleteType: 'file' or 'client'
    - client: client name
    - category: (optional) category for file deletion
    - fileName: (optional) file name for file deletion
    """
    logging.info('DeleteDocument function triggered')
    
    try:
        # Parse request body
        req_body = req.get_json()
        delete_type = req_body.get('deleteType', 'file')
        client_name = req_body.get('client')
        category = req_body.get('category')
        file_name = req_body.get('fileName')
        
        if not client_name:
            return func.HttpResponse(
                json.dumps({"error": "Client name is required"}),
                status_code=400,
                mimetype="application/json"
            )
        
        deletion_summary = {
            "timestamp": datetime.utcnow().isoformat(),
            "deleteType": delete_type,
            "client": client_name,
            "category": category,
            "fileName": file_name,
            "deletedBlobs": [],
            "deletedIndexDocuments": 0,
            "errors": []
        }
        
        # Initialize Azure clients
        blob_service_client = BlobServiceClient.from_connection_string(STORAGE_CONNECTION_STRING)
        
        if delete_type == 'client':
            # Delete entire client
            deletion_summary = await delete_client(
                blob_service_client,
                client_name,
                deletion_summary
            )
        else:
            # Delete specific file
            if not file_name:
                return func.HttpResponse(
                    json.dumps({"error": "File name is required for file deletion"}),
                    status_code=400,
                    mimetype="application/json"
                )
            
            deletion_summary = await delete_file(
                blob_service_client,
                client_name,
                category,
                file_name,
                deletion_summary
            )
        
        # Return deletion summary
        return func.HttpResponse(
            json.dumps({
                "success": True,
                "message": f"Successfully processed deletion request",
                "summary": deletion_summary
            }),
            status_code=200,
            mimetype="application/json"
        )
        
    except Exception as e:
        logging.error(f"Error in DeleteDocument: {str(e)}")
        return func.HttpResponse(
            json.dumps({
                "success": False,
                "error": str(e)
            }),
            status_code=500,
            mimetype="application/json"
        )

async def delete_client(
    blob_service_client: BlobServiceClient,
    client_name: str,
    summary: Dict
) -> Dict:
    """Delete all documents for a client."""
    
    # Prefixes to search for
    prefixes = [
        f"FCS-OriginalClients/{client_name}/",
        f"FCS-ConvertedClients/{client_name}/"
    ]
    
    # Delete blobs from both containers
    for prefix in prefixes:
        deleted_count = await delete_blobs_with_prefix(
            blob_service_client,
            CONTAINER_ORIGINAL if "Original" in prefix else CONTAINER_CONVERTED,
            prefix,
            summary
        )
        logging.info(f"Deleted {deleted_count} blobs with prefix: {prefix}")
    
    # Delete from search index
    if SEARCH_API_KEY:
        deleted_docs = await delete_from_search_index(
            client=client_name,
            summary=summary
        )
        summary["deletedIndexDocuments"] = deleted_docs
        logging.info(f"Deleted {deleted_docs} documents from search index for client: {client_name}")
    
    return summary

async def delete_file(
    blob_service_client: BlobServiceClient,
    client_name: str,
    category: str,
    file_name: str,
    summary: Dict
) -> Dict:
    """Delete a specific file."""
    
    # Build file paths
    original_path = f"FCS-OriginalClients/{client_name}/{category}/{file_name}"
    
    # Handle converted path (remove extension and add .jsonl)
    base_name = file_name.rsplit('.', 1)[0] if '.' in file_name else file_name
    converted_path = f"FCS-ConvertedClients/{client_name}/{category}/{base_name}.jsonl"
    
    # Delete original file
    if await delete_blob(blob_service_client, CONTAINER_ORIGINAL, original_path):
        summary["deletedBlobs"].append(original_path)
        logging.info(f"Deleted original file: {original_path}")
    
    # Delete converted file
    if await delete_blob(blob_service_client, CONTAINER_CONVERTED, converted_path):
        summary["deletedBlobs"].append(converted_path)
        logging.info(f"Deleted converted file: {converted_path}")
    
    # Delete metadata file (if exists)
    # First, list metadata files to find the one associated with this file
    metadata_prefix = f"FCS-OriginalClients/{client_name}/.metadata/"
    container_client = blob_service_client.get_container_client(CONTAINER_ORIGINAL)
    
    try:
        blobs = container_client.list_blobs(name_starts_with=metadata_prefix)
        for blob in blobs:
            # Download and check metadata
            blob_client = container_client.get_blob_client(blob.name)
            metadata_content = blob_client.download_blob().readall()
            metadata = json.loads(metadata_content)
            
            if metadata.get('fileName') == file_name:
                # Found matching metadata file
                if await delete_blob(blob_service_client, CONTAINER_ORIGINAL, blob.name):
                    summary["deletedBlobs"].append(blob.name)
                    logging.info(f"Deleted metadata file: {blob.name}")
                break
    except Exception as e:
        logging.warning(f"Could not delete metadata file: {str(e)}")
        summary["errors"].append(f"Metadata deletion warning: {str(e)}")
    
    # Delete from search index
    if SEARCH_API_KEY:
        source_id = f"{client_name}/{category}/{file_name}"
        deleted_docs = await delete_from_search_index(
            source_id=source_id,
            summary=summary
        )
        summary["deletedIndexDocuments"] = deleted_docs
        logging.info(f"Deleted {deleted_docs} documents from search index for file: {file_name}")
    
    return summary

async def delete_blobs_with_prefix(
    blob_service_client: BlobServiceClient,
    container_name: str,
    prefix: str,
    summary: Dict
) -> int:
    """Delete all blobs with a given prefix."""
    
    deleted_count = 0
    container_client = blob_service_client.get_container_client(container_name)
    
    try:
        # List all blobs with the prefix
        blobs = container_client.list_blobs(name_starts_with=prefix)
        
        for blob in blobs:
            try:
                blob_client = container_client.get_blob_client(blob.name)
                blob_client.delete_blob()
                summary["deletedBlobs"].append(blob.name)
                deleted_count += 1
            except Exception as e:
                error_msg = f"Failed to delete blob {blob.name}: {str(e)}"
                logging.error(error_msg)
                summary["errors"].append(error_msg)
    
    except Exception as e:
        error_msg = f"Error listing blobs with prefix {prefix}: {str(e)}"
        logging.error(error_msg)
        summary["errors"].append(error_msg)
    
    return deleted_count

async def delete_blob(
    blob_service_client: BlobServiceClient,
    container_name: str,
    blob_name: str
) -> bool:
    """Delete a single blob."""
    
    try:
        blob_client = blob_service_client.get_blob_client(
            container=container_name,
            blob=blob_name
        )
        blob_client.delete_blob()
        return True
    except ResourceNotFoundError:
        logging.info(f"Blob not found (already deleted?): {blob_name}")
        return False
    except Exception as e:
        logging.error(f"Error deleting blob {blob_name}: {str(e)}")
        return False

async def delete_from_search_index(
    client: str = None,
    source_id: str = None,
    summary: Dict = None
) -> int:
    """Delete documents from search index."""
    
    if not SEARCH_API_KEY:
        logging.warning("Search API key not configured, skipping index deletion")
        return 0
    
    deleted_count = 0
    
    try:
        search_client = SearchClient(
            endpoint=SEARCH_ENDPOINT,
            index_name=SEARCH_INDEX_NAME,
            credential=AzureKeyCredential(SEARCH_API_KEY)
        )
        
        # Build filter
        if source_id:
            filter_query = f"source_id eq '{source_id}'"
        elif client:
            filter_query = f"client eq '{client}'"
        else:
            return 0
        
        # Search for documents to delete
        results = search_client.search(
            search_text="*",
            filter=filter_query,
            select=["id"],
            top=1000  # Adjust if needed
        )
        
        # Collect document IDs
        doc_ids = []
        for doc in results:
            doc_ids.append(doc["id"])
        
        if doc_ids:
            # Delete documents in batches
            batch_size = 100
            for i in range(0, len(doc_ids), batch_size):
                batch_ids = doc_ids[i:i + batch_size]
                delete_actions = [
                    {"@search.action": "delete", "id": doc_id}
                    for doc_id in batch_ids
                ]
                
                result = search_client.upload_documents(documents=delete_actions)
                deleted_count += len(batch_ids)
                logging.info(f"Deleted batch of {len(batch_ids)} documents from search index")
        
    except Exception as e:
        error_msg = f"Error deleting from search index: {str(e)}"
        logging.error(error_msg)
        if summary:
            summary["errors"].append(error_msg)
    
    return deleted_count
