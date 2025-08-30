# n8n Workflow Fix: Document ID Header

## Problem
The "Upload Converted JSONL" HTTP Request node has a header that references an unexecuted node:
```
"x-ms-meta-documentid": "={{ $node['Prepare Search Index1'].json.documentId }}"
```

## Solution Options

### Option 1: Use the File Name as Document ID (Recommended)
Change the header value to use the current file being processed:
```
"x-ms-meta-documentid": "={{ $json.fileName.replace(/\.[^/.]+$/, '') }}"
```
This uses the filename without extension as the document ID.

### Option 2: Use a Unique ID from Earlier in the Workflow
If you have a node that generates or processes the document ID earlier in your workflow, reference that node instead. For example:
```
"x-ms-meta-documentid": "={{ $item(0).$node['YourActualNode'].json.documentId }}"
```

### Option 3: Generate a Document ID
Use n8n's built-in functions to create a unique ID:
```
"x-ms-meta-documentid": "={{ $json.clientName }}_{{ $json.fileName }}_{{ Date.now() }}"
```

## How to Apply the Fix

1. Open your n8n workflow
2. Find the "Upload Converted JSONL" HTTP Request node
3. Go to the Headers section
4. Find the header with name: `x-ms-meta-documentid`
5. Replace the value with one of the options above
6. Save and test your workflow

## Why This Matters for Hybrid Index

Since you're using a hybrid index approach, having consistent document IDs between:
- The files in Azure Blob Storage (via metadata)
- The Azure Search index

This ensures that when documents are updated or deleted, the correct document is targeted in both systems.

## Verification

After fixing, verify that:
1. The workflow runs without the "Referenced node is unexecuted" error
2. Files uploaded to Azure Blob Storage have the correct metadata
3. The document IDs in your Azure Search index match the blob metadata
