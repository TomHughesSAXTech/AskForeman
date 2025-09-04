// Function to update document count (excluding placeholders)
async function updateDocumentCount() {
    try {
        const response = await fetch('https://fcssearchservice.search.windows.net/indexes/fcs-construction-docs-index-v2/docs/$count?api-version=2023-11-01&$filter=client ne \'placeholder\'', {
            headers: {
                'api-key': 'YOUR_SEARCH_KEY',
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const count = await response.json();
            const countElements = document.querySelectorAll('.document-count, #document-count');
            countElements.forEach(el => {
                el.textContent = count.toLocaleString();
            });
        }
    } catch (error) {
        console.error('Error fetching document count:', error);
        // Fallback to calculating from blob storage
        fetchDocumentCountFromBlob();
    }
}

async function fetchDocumentCountFromBlob() {
    // Get count from original client directories excluding placeholder
    const clients = ['client1', 'client2', 'client3']; // Add actual client names
    let totalCount = 0;
    
    for (const client of clients) {
        if (client !== 'placeholder') {
            // Count documents in client directory
            // Implementation depends on your blob storage structure
            totalCount += await getClientDocumentCount(client);
        }
    }
    
    const countElements = document.querySelectorAll('.document-count, #document-count');
    countElements.forEach(el => {
        el.textContent = totalCount.toLocaleString();
    });
}

// Call on page load
document.addEventListener('DOMContentLoaded', updateDocumentCount);
