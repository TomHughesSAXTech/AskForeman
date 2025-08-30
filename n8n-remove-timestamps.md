# Alternative Solution: Remove Timestamps from Filenames

## Overview
This simpler solution removes timestamps from filenames entirely, allowing Azure's built-in duplicate detection to work naturally.

## Option 1: Simple Fix - Remove Timestamp Generation

### Modify "Prepare File Data" Node
Replace the timestamp logic in your "Prepare File Data" node:

**CURRENT CODE (With Timestamps):**
```javascript
// This adds timestamps to every file
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const uniqueFileName = `${nameWithoutExt}_${timestamp}${extension}`;
```

**NEW CODE (Without Timestamps):**
```javascript
// Simple version - just use the original filename
const fileName = uploadData.fileName || 'file';

// No timestamp added - files with same name will overwrite
const uniqueFileName = fileName;

// Or if you want to clean the filename:
const cleanFileName = fileName
  .replace(/[^a-zA-Z0-9._-]/g, '_')  // Replace special chars with underscore
  .replace(/_{2,}/g, '_')             // Remove multiple underscores
  .trim();

return {
  ...uploadData,
  fileName: cleanFileName,
  uniqueFileName: cleanFileName,
  originalFileName: fileName,
  // ... rest of your fields
};
```

## Option 2: Smart Deduplication - Hash-Based Unique IDs

### Modify "Prepare File Data" Node
Use content-based deduplication instead of timestamps:

```javascript
// Smart deduplication using file content hash
const uploadData = $json;
const fileName = uploadData.fileName || 'file';
const client = uploadData.client || uploadData.clientName || '';
const category = uploadData.category || uploadData.categoryFolder || '';

// Extract file extension
const lastDot = fileName.lastIndexOf('.');
const extension = lastDot > -1 ? fileName.slice(lastDot) : '';
const nameWithoutExt = lastDot > -1 ? fileName.slice(0, lastDot) : fileName;

// Create a deterministic ID based on client, category, and filename
// This ensures the same file always gets the same name
const fileIdentifier = `${client}_${category}_${nameWithoutExt}`;

// Simple hash function for the identifier
let hash = 0;
for (let i = 0; i < fileIdentifier.length; i++) {
  const char = fileIdentifier.charCodeAt(i);
  hash = ((hash << 5) - hash) + char;
  hash = hash & hash; // Convert to 32bit integer
}
const shortHash = Math.abs(hash).toString(36).substring(0, 6);

// Create filename that's unique per file but consistent for same file
// Format: originalname_abc123.ext
const consistentFileName = `${nameWithoutExt}_${shortHash}${extension}`;

return {
  ...uploadData,
  fileName: consistentFileName,
  uniqueFileName: consistentFileName,
  originalFileName: fileName,
  fileHash: shortHash,
  // ... rest of your fields
};
```

## Option 3: Versioning System

### Add Version Tracking
Keep track of file versions instead of timestamps:

```javascript
// Version-based file naming
const uploadData = $json;
const fileName = uploadData.fileName || 'file';
const client = uploadData.client || uploadData.clientName || '';
const category = uploadData.category || uploadData.categoryFolder || '';

// Extract file extension
const lastDot = fileName.lastIndexOf('.');
const extension = lastDot > -1 ? fileName.slice(lastDot) : '';
const nameWithoutExt = lastDot > -1 ? fileName.slice(0, lastDot) : fileName;

// For versioning, you'd need to check existing files first
// This is a simplified version
const baseFileName = `${nameWithoutExt}${extension}`;

// Option A: Always overwrite (no version)
const finalFileName = baseFileName;

// Option B: Add version only if specified
const version = uploadData.version || '';
const versionedFileName = version ? `${nameWithoutExt}_v${version}${extension}` : baseFileName;

return {
  ...uploadData,
  fileName: finalFileName, // or versionedFileName
  uniqueFileName: finalFileName,
  originalFileName: fileName,
  baseFileName: baseFileName,
  version: version,
  // ... rest of your fields
};
```

## Comparison of Solutions

| Solution | Pros | Cons | Best For |
|----------|------|------|----------|
| **Remove Timestamps** | Simple, automatic overwrite | No file history | When you always want latest version |
| **Hash-Based IDs** | Consistent IDs, no duplicates | Harder to read filenames | When you need deterministic names |
| **Versioning** | Clear version history | Requires manual version input | When you need to track versions |

## Quick Implementation Guide

### For Immediate Fix (Remove Timestamps):

1. **Open your n8n workflow**
2. **Find "Prepare File Data" node**
3. **Locate this section:**
   ```javascript
   const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
   const uniqueFileName = `${nameWithoutExt}_${timestamp}${extension}`;
   ```
4. **Replace with:**
   ```javascript
   const uniqueFileName = fileName; // Simple: use original name
   // OR
   const uniqueFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_'); // Clean special chars
   ```
5. **Update the return statement:**
   ```javascript
   return {
     ...uploadData,
     fileName: uniqueFileName,
     uniqueFileName: uniqueFileName,
     // Remove or comment out timestamp field
     // timestamp: timestamp,
   };
   ```

## Impact on Your Workflow

### What Changes:
- Files with same name will overwrite existing files
- No more accumulation of timestamped duplicates
- Cleaner file structure in Azure Blob Storage

### What Stays the Same:
- Indexing process remains unchanged
- Search functionality works as before
- File upload process is actually simpler

## Testing After Implementation

1. **Upload a file** - Should upload normally
2. **Upload same file again** - Should overwrite without creating duplicate
3. **Check Azure Blob Storage** - Should show single file, not multiple versions
4. **Test search** - Should still find the file content
5. **Check indexing** - Document should be updated in search index

## Rollback Plan

If you need to go back to timestamps:
```javascript
// Re-add timestamp generation
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const uniqueFileName = `${nameWithoutExt}_${timestamp}${extension}`;
```

## Recommended Approach

**For your use case, I recommend Option 1 (Remove Timestamps) because:**
1. It's the simplest solution
2. Azure Blob Storage naturally handles overwrites
3. Your search index will automatically update
4. No duplicate files accumulating in storage
5. Users get the overwrite prompt they expect
