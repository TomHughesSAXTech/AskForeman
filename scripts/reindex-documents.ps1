#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Reindex existing documents in Azure Blob Storage through the ConvertDocument flow.

.DESCRIPTION
    This script lists all documents in the FCS-OriginalClients container and re-processes
    them through the ConvertDocument Azure Function to rebuild the search index with
    proper metadata and vectorization.

.PARAMETER ClientFilter
    Optional filter to process only documents for a specific client.

.PARAMETER CategoryFilter
    Optional filter to process only documents in a specific category.

.PARAMETER BatchSize
    Number of documents to process in parallel (default: 5).

.PARAMETER DryRun
    If specified, only lists documents that would be processed without actually processing them.

.EXAMPLE
    .\reindex-documents.ps1
    
.EXAMPLE
    .\reindex-documents.ps1 -ClientFilter "ClientA" -CategoryFilter "safety" -BatchSize 10
    
.EXAMPLE
    .\reindex-documents.ps1 -DryRun
#>

param(
    [string]$ClientFilter = "",
    [string]$CategoryFilter = "",
    [int]$BatchSize = 5,
    [switch]$DryRun
)

# Configuration
$StorageAccountName = "saxtechfcs"
$ContainerName = "fcs-clients"
$SasToken = "sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D"
$QueueName = "document-conversion"
$QueueSasToken = "sp=raup&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D"
$FunctionAppUrl = "https://saxtech-docconverter.azurewebsites.net/api/ConvertDocument"
$FunctionAppKey = "" # Add your function key here if using HTTP trigger

# Build base URLs
$BlobBaseUrl = "https://$StorageAccountName.blob.core.windows.net/$ContainerName"
$QueueBaseUrl = "https://$StorageAccountName.queue.core.windows.net/$QueueName"

# Function to list blobs
function Get-BlobList {
    param(
        [string]$Prefix = ""
    )
    
    $listUrl = "$BlobBaseUrl`?restype=container&comp=list&$SasToken"
    if ($Prefix) {
        $listUrl += "&prefix=$Prefix"
    }
    
    $response = Invoke-RestMethod -Uri $listUrl -Method GET
    $blobs = @()
    
    if ($response.EnumerationResults.Blobs.Blob) {
        foreach ($blob in $response.EnumerationResults.Blobs.Blob) {
            $blobs += @{
                Name = $blob.Name
                Url = $blob.Url
                Properties = $blob.Properties
            }
        }
    }
    
    return $blobs
}

# Function to parse blob path
function Parse-BlobPath {
    param(
        [string]$BlobName
    )
    
    $parts = $BlobName -split '/'
    
    if ($parts.Count -ge 3 -and $parts[0] -eq "FCS-OriginalClients") {
        return @{
            Client = $parts[1]
            Category = $parts[2]
            FileName = if ($parts.Count -gt 3) { $parts[3..$($parts.Count-1)] -join '/' } else { "" }
            IsValid = $true
        }
    }
    
    return @{ IsValid = $false }
}

# Function to queue document for conversion
function Queue-DocumentConversion {
    param(
        [hashtable]$Document
    )
    
    $message = @{
        blobUrl = "$BlobBaseUrl/$($Document.Name)?$SasToken"
        fileName = $Document.ParsedPath.FileName
        client = $Document.ParsedPath.Client
        category = $Document.ParsedPath.Category
        originalPath = $Document.Name
        convertedPath = $Document.Name -replace "FCS-OriginalClients", "FCS-ConvertedClients" -replace "\.pdf$", ".jsonl"
        fileHash = ""  # Will be calculated by the function
        timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    }
    
    $messageJson = $message | ConvertTo-Json -Compress
    $messageBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($messageJson))
    
    $queueMessage = @"
<QueueMessage>
    <MessageText>$messageBase64</MessageText>
</QueueMessage>
"@
    
    $headers = @{
        "x-ms-version" = "2024-11-04"
        "Content-Type" = "application/xml"
    }
    
    $queueUrl = "$QueueBaseUrl/messages?$QueueSasToken"
    
    try {
        $response = Invoke-RestMethod -Uri $queueUrl -Method POST -Headers $headers -Body $queueMessage
        return @{ Success = $true; Message = "Queued successfully" }
    }
    catch {
        return @{ Success = $false; Message = $_.Exception.Message }
    }
}

# Main processing logic
Write-Host "=== SAXTech Foreman AI - Document Reindexing Script ===" -ForegroundColor Cyan
Write-Host ""

# Build prefix for filtering
$prefix = "FCS-OriginalClients/"
if ($ClientFilter) {
    $prefix += "$ClientFilter/"
    if ($CategoryFilter) {
        $prefix += "$CategoryFilter/"
    }
}

Write-Host "Listing documents with prefix: $prefix" -ForegroundColor Yellow
$blobs = Get-BlobList -Prefix $prefix

# Filter and parse blobs
$documents = @()
foreach ($blob in $blobs) {
    $parsed = Parse-BlobPath -BlobName $blob.Name
    
    if ($parsed.IsValid -and $parsed.FileName -and 
        $parsed.FileName -notlike "*.metadata*" -and 
        $parsed.FileName -notlike "*.json" -and
        $parsed.Category -ne ".metadata") {
        
        # Additional filtering
        if ((!$ClientFilter -or $parsed.Client -eq $ClientFilter) -and
            (!$CategoryFilter -or $parsed.Category -eq $CategoryFilter)) {
            
            $documents += @{
                Name = $blob.Name
                ParsedPath = $parsed
                Properties = $blob.Properties
            }
        }
    }
}

Write-Host "Found $($documents.Count) documents to process" -ForegroundColor Green
Write-Host ""

if ($DryRun) {
    Write-Host "DRY RUN MODE - No documents will be processed" -ForegroundColor Magenta
    Write-Host ""
    
    foreach ($doc in $documents) {
        Write-Host "  - $($doc.ParsedPath.Client)/$($doc.ParsedPath.Category)/$($doc.ParsedPath.FileName)"
    }
    
    Write-Host ""
    Write-Host "To process these documents, run without -DryRun flag" -ForegroundColor Yellow
    exit 0
}

# Process documents in batches
$totalDocuments = $documents.Count
$processedCount = 0
$successCount = 0
$failureCount = 0
$failures = @()

Write-Host "Processing documents in batches of $BatchSize..." -ForegroundColor Cyan
Write-Host ""

for ($i = 0; $i -lt $totalDocuments; $i += $BatchSize) {
    $batch = $documents[$i..[Math]::Min($i + $BatchSize - 1, $totalDocuments - 1)]
    $batchNumber = [Math]::Floor($i / $BatchSize) + 1
    $totalBatches = [Math]::Ceiling($totalDocuments / $BatchSize)
    
    Write-Host "Processing batch $batchNumber of $totalBatches..." -ForegroundColor Yellow
    
    foreach ($doc in $batch) {
        $processedCount++
        $percentComplete = [Math]::Round(($processedCount / $totalDocuments) * 100, 1)
        
        Write-Progress -Activity "Reindexing Documents" `
                      -Status "Processing: $($doc.ParsedPath.FileName)" `
                      -PercentComplete $percentComplete `
                      -CurrentOperation "Document $processedCount of $totalDocuments"
        
        Write-Host "  [$processedCount/$totalDocuments] $($doc.ParsedPath.Client)/$($doc.ParsedPath.Category)/$($doc.ParsedPath.FileName)... " -NoNewline
        
        $result = Queue-DocumentConversion -Document $doc
        
        if ($result.Success) {
            Write-Host "✓" -ForegroundColor Green
            $successCount++
        }
        else {
            Write-Host "✗" -ForegroundColor Red
            Write-Host "    Error: $($result.Message)" -ForegroundColor Red
            $failureCount++
            $failures += @{
                Document = $doc.Name
                Error = $result.Message
            }
        }
        
        # Small delay to avoid overwhelming the queue
        Start-Sleep -Milliseconds 100
    }
    
    Write-Host ""
}

Write-Progress -Activity "Reindexing Documents" -Completed

# Summary
Write-Host "=== Reindexing Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total documents processed: $totalDocuments" -ForegroundColor White
Write-Host "Successfully queued: $successCount" -ForegroundColor Green
Write-Host "Failed: $failureCount" -ForegroundColor Red

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed documents:" -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host "  - $($failure.Document): $($failure.Error)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Documents have been queued for processing. The Azure Function will process them asynchronously." -ForegroundColor Yellow
Write-Host "Monitor the Azure Function logs for processing status." -ForegroundColor Yellow
