# n8n Workflow Fix Instructions

## Problem
The "Upload Converted JSONL" HTTP Request node has a header parameter referencing an unexecuted node:
```
x-ms-meta-documentid: {{ $node['Prepare Search Index1'].json.documentId }}
```

## Solution
In your n8n workflow, go to the "Upload Converted JSONL" HTTP Request node and:

1. Find the Headers section
2. Look for the header: `x-ms-meta-documentid`
3. Either:
   - Remove this header entirely (recommended if not needed)
   - OR change it to use a value from an executed node
   - OR use a static value like: `{{ $json.fileName }}`

## Quick Fix
Remove the problematic header:
- Header Name: `x-ms-meta-documentid` 
- DELETE this entire header row

The other headers should remain:
- `x-ms-version`: `2024-11-04`
- `x-ms-blob-type`: `BlockBlob`
- `Content-Type`: `application/jsonl`
