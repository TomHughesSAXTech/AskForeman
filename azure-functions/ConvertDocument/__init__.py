import logging
import json
import base64
import hashlib
import os
from typing import Dict, List, Any, Optional
from datetime import datetime
import azure.functions as func
from azure.storage.blob import BlobServiceClient
from azure.search.documents import SearchClient
from azure.search.documents.models import IndexAction
from azure.core.credentials import AzureKeyCredential
import openai
from openai import AzureOpenAI
import PyPDF2
import io
import re

# Configuration from environment variables
STORAGE_CONNECTION_STRING = os.environ.get('AzureWebJobsStorage')
STORAGE_ACCOUNT_NAME = os.environ.get('AZURE_STORAGE_ACCOUNT_NAME', 'saxtechfcs')
CONTAINER_ORIGINAL = os.environ.get('AZURE_STORAGE_CONTAINER_ORIGINAL', 'fcs-clients')
CONTAINER_CONVERTED = os.environ.get('AZURE_STORAGE_CONTAINER_CONVERTED', 'fcs-clients')

SEARCH_ENDPOINT = os.environ.get('AZURE_SEARCH_ENDPOINT', 'https://saxtechsearch.search.windows.net')
SEARCH_API_KEY = os.environ.get('AZURE_SEARCH_API_KEY')
SEARCH_INDEX_NAME = os.environ.get('AZURE_SEARCH_INDEX_NAME', 'saxtech-foreman-index')

OPENAI_ENDPOINT = os.environ.get('AZURE_OPENAI_ENDPOINT')
OPENAI_API_KEY = os.environ.get('AZURE_OPENAI_API_KEY')
OPENAI_DEPLOYMENT = os.environ.get('AZURE_OPENAI_DEPLOYMENT_NAME', 'text-embedding-ada-002')
OPENAI_API_VERSION = os.environ.get('AZURE_OPENAI_API_VERSION', '2024-02-01')

# Feature flags
ENABLE_OCR = os.environ.get('FEATURE_ENABLE_OCR', 'true').lower() == 'true'
ENABLE_VECTORIZATION = os.environ.get('FEATURE_ENABLE_VECTORIZATION', 'true').lower() == 'true'
ENABLE_CHUNKING = os.environ.get('FEATURE_ENABLE_CHUNKING', 'true').lower() == 'true'
CHUNK_SIZE = int(os.environ.get('FEATURE_CHUNK_SIZE', '1000'))
CHUNK_OVERLAP = int(os.environ.get('FEATURE_CHUNK_OVERLAP', '200'))

def main(msg: func.QueueMessage) -> None:
    """
    Process document conversion from queue message.
    Handles PDF extraction, chunking, vectorization, and indexing with deduplication.
    """
    logging.info('ConvertDocument function triggered by queue message')
    
    try:
        # Parse queue message
        message_body = msg.get_body().decode('utf-8')
        message_data = json.loads(message_body)
        
        logging.info(f"Processing document: {message_data.get('fileName')} for client: {message_data.get('client')}")
        
        # Extract message parameters
        blob_url = message_data.get('blobUrl')
        file_name = message_data.get('fileName')
        client_name = message_data.get('client')
        category = message_data.get('category')
        original_path = message_data.get('originalPath')
        converted_path = message_data.get('convertedPath')
        file_hash = message_data.get('fileHash', '')
        
        # Download the document from blob storage
        document_content = download_blob(blob_url)
        
        # Calculate hash if not provided
        if not file_hash:
            file_hash = calculate_hash(document_content)
        
        # Extract text from PDF
        extracted_text = extract_pdf_text(document_content)
        
        # Process document into chunks
        chunks = []
        if ENABLE_CHUNKING:
            chunks = chunk_text(extracted_text, CHUNK_SIZE, CHUNK_OVERLAP)
        else:
            chunks = [extracted_text]
        
        # Generate vectors if enabled
        vectors = []
        if ENABLE_VECTORIZATION:
            vectors = generate_embeddings(chunks)
        
        # Prepare documents for indexing
        index_documents = []
        jsonl_documents = []
        
        for i, chunk in enumerate(chunks):
            # Create unique document ID using hash and chunk number
            doc_id = f"{file_hash}_{i}"
            source_id = f"{client_name}/{category}/{file_name}"
            
            # Prepare index document
            index_doc = {
                "id": doc_id,
                "client": client_name,
                "category": category,
                "file_name": file_name,
                "file_path": original_path,
                "page_num": i + 1,
                "total_pages": len(chunks),
                "content": chunk,
                "source_id": source_id,
                "file_hash": file_hash,
                "indexed_at": datetime.utcnow().isoformat(),
                "chunk_size": len(chunk),
                "metadata": json.dumps({
                    "original_path": original_path,
                    "converted_path": converted_path,
                    "processing_timestamp": datetime.utcnow().isoformat()
                })
            }
            
            # Add vector if available
            if i < len(vectors):
                index_doc["content_vector"] = vectors[i]
            
            index_documents.append(index_doc)
            
            # Prepare JSONL document
            jsonl_doc = {
                "id": doc_id,
                "client": client_name,
                "category": category,
                "file_name": file_name,
                "page_num": i + 1,
                "content": chunk,
                "source_id": source_id,
                "file_hash": file_hash
            }
            jsonl_documents.append(jsonl_doc)
        
        # Upload to search index with deduplication
        upload_to_search_index(index_documents, source_id)
        
        # Save JSONL file to blob storage
        save_jsonl_to_blob(jsonl_documents, converted_path)
        
        # Update metadata
        update_metadata(original_path, file_hash, {
            "status": "processed",
            "chunks_created": len(chunks),
            "processed_at": datetime.utcnow().isoformat(),
            "converted_path": converted_path
        })
        
        logging.info(f"Successfully processed document: {file_name} with {len(chunks)} chunks")
        
    except Exception as e:
        logging.error(f"Error processing document: {str(e)}")
        raise

def download_blob(blob_url: str) -> bytes:
    """Download blob content from URL."""
    import requests
    response = requests.get(blob_url)
    response.raise_for_status()
    return response.content

def calculate_hash(content: bytes) -> str:
    """Calculate SHA-256 hash of content."""
    return hashlib.sha256(content).hexdigest()

def extract_pdf_text(pdf_content: bytes) -> str:
    """Extract text from PDF content."""
    try:
        pdf_file = io.BytesIO(pdf_content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        
        text = ""
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            page_text = page.extract_text()
            
            # Clean up text
            page_text = re.sub(r'\s+', ' ', page_text)
            page_text = page_text.strip()
            
            text += page_text + "\n\n"
        
        return text.strip()
    except Exception as e:
        logging.error(f"Error extracting PDF text: {str(e)}")
        # If PDF extraction fails, try treating as text
        try:
            return pdf_content.decode('utf-8', errors='ignore')
        except:
            return ""

def chunk_text(text: str, chunk_size: int, overlap: int) -> List[str]:
    """Split text into overlapping chunks."""
    if not text:
        return []
    
    chunks = []
    words = text.split()
    
    if len(words) <= chunk_size:
        return [text]
    
    for i in range(0, len(words), chunk_size - overlap):
        chunk_words = words[i:i + chunk_size]
        chunk = ' '.join(chunk_words)
        chunks.append(chunk)
        
        if i + chunk_size >= len(words):
            break
    
    return chunks

def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for text chunks using Azure OpenAI."""
    if not ENABLE_VECTORIZATION or not OPENAI_API_KEY:
        return []
    
    try:
        client = AzureOpenAI(
            api_key=OPENAI_API_KEY,
            api_version=OPENAI_API_VERSION,
            azure_endpoint=OPENAI_ENDPOINT
        )
        
        embeddings = []
        for text in texts:
            # Truncate text if too long (max 8191 tokens for ada-002)
            truncated_text = text[:8000] if len(text) > 8000 else text
            
            response = client.embeddings.create(
                input=truncated_text,
                model=OPENAI_DEPLOYMENT
            )
            
            embedding = response.data[0].embedding
            embeddings.append(embedding)
        
        return embeddings
    except Exception as e:
        logging.error(f"Error generating embeddings: {str(e)}")
        return []

def upload_to_search_index(documents: List[Dict], source_id: str) -> None:
    """
    Upload documents to Azure Cognitive Search with deduplication.
    Replaces existing documents with the same source_id.
    """
    if not SEARCH_API_KEY:
        logging.warning("Search API key not configured, skipping index upload")
        return
    
    try:
        search_client = SearchClient(
            endpoint=SEARCH_ENDPOINT,
            index_name=SEARCH_INDEX_NAME,
            credential=AzureKeyCredential(SEARCH_API_KEY)
        )
        
        # First, delete existing documents with the same source_id
        try:
            # Search for existing documents
            results = search_client.search(
                search_text="*",
                filter=f"source_id eq '{source_id}'",
                select=["id"]
            )
            
            # Collect IDs to delete
            ids_to_delete = [doc["id"] for doc in results]
            
            if ids_to_delete:
                logging.info(f"Removing {len(ids_to_delete)} existing documents for source_id: {source_id}")
                # Delete existing documents
                delete_actions = [{"@search.action": "delete", "id": doc_id} for doc_id in ids_to_delete]
                search_client.upload_documents(documents=delete_actions)
        except Exception as e:
            logging.warning(f"Could not delete existing documents: {str(e)}")
        
        # Upload new documents
        logging.info(f"Uploading {len(documents)} documents to search index")
        
        # Add search action to each document
        for doc in documents:
            doc["@search.action"] = "upload"
        
        # Upload in batches of 100
        batch_size = 100
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            result = search_client.upload_documents(documents=batch)
            logging.info(f"Uploaded batch {i//batch_size + 1}: {len(result)} documents")
        
    except Exception as e:
        logging.error(f"Error uploading to search index: {str(e)}")
        raise

def save_jsonl_to_blob(documents: List[Dict], blob_path: str) -> None:
    """Save documents as JSONL file to blob storage."""
    try:
        # Create JSONL content
        jsonl_content = '\n'.join([json.dumps(doc, ensure_ascii=False) for doc in documents])
        
        # Initialize blob client
        blob_service_client = BlobServiceClient.from_connection_string(STORAGE_CONNECTION_STRING)
        
        # Upload to converted container
        blob_client = blob_service_client.get_blob_client(
            container=CONTAINER_CONVERTED,
            blob=blob_path
        )
        
        # Upload with metadata
        blob_client.upload_blob(
            jsonl_content.encode('utf-8'),
            overwrite=True,
            metadata={
                "document_count": str(len(documents)),
                "processed_at": datetime.utcnow().isoformat(),
                "file_type": "jsonl"
            }
        )
        
        logging.info(f"Saved JSONL file to: {blob_path}")
        
    except Exception as e:
        logging.error(f"Error saving JSONL to blob: {str(e)}")
        raise

def update_metadata(original_path: str, file_hash: str, metadata: Dict) -> None:
    """Update metadata file in blob storage."""
    try:
        blob_service_client = BlobServiceClient.from_connection_string(STORAGE_CONNECTION_STRING)
        
        # Extract client name from path
        path_parts = original_path.split('/')
        if len(path_parts) >= 2:
            client_name = path_parts[1]
            metadata_path = f"FCS-OriginalClients/{client_name}/.metadata/{file_hash}.json"
            
            # Get existing metadata
            blob_client = blob_service_client.get_blob_client(
                container=CONTAINER_ORIGINAL,
                blob=metadata_path
            )
            
            try:
                existing_data = blob_client.download_blob().readall()
                existing_metadata = json.loads(existing_data)
            except:
                existing_metadata = {}
            
            # Update metadata
            existing_metadata.update(metadata)
            
            # Upload updated metadata
            blob_client.upload_blob(
                json.dumps(existing_metadata, indent=2).encode('utf-8'),
                overwrite=True
            )
            
            logging.info(f"Updated metadata for hash: {file_hash}")
            
    except Exception as e:
        logging.warning(f"Could not update metadata: {str(e)}")
