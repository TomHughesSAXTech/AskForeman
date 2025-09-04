// Function to update document count from blob storage (excluding placeholders)
async function updateDocumentCount() {
    try {
        // List all files in the FCS-OriginalClients directory
        const listUrl = `https://saxtechfcs.blob.core.windows.net/fcs-clients?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D&restype=container&comp=list&prefix=FCS-OriginalClients/`;
        
        const response = await fetch(listUrl);
        if (response.ok) {
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            
            // Get all blob entries (actual files)
            const blobs = xmlDoc.getElementsByTagName("Blob");
            
            let documentCount = 0;
            for (let i = 0; i < blobs.length; i++) {
                const nameElement = blobs[i].getElementsByTagName("Name")[0];
                if (nameElement) {
                    const fullPath = nameElement.textContent;
                    const fileName = fullPath.split('/').pop();
                    
                    // Exclude placeholder files and hidden files
                    if (fileName && 
                        fileName !== '.placeholder' && 
                        fileName !== 'placeholder' &&
                        !fileName.startsWith('.') &&
                        fileName.length > 0) {
                        
                        // Check if it's in a client folder (not the placeholder folder)
                        const pathParts = fullPath.split('/');
                        if (pathParts.length >= 3 && pathParts[0] === 'FCS-OriginalClients') {
                            const clientName = pathParts[1];
                            if (clientName && 
                                clientName.toLowerCase() !== 'placeholder' && 
                                !clientName.startsWith('.')) {
                                documentCount++;
                            }
                        }
                    }
                }
            }
            
            // Update all elements with document count
            const countElements = document.querySelectorAll('.document-count, #document-count, #docCount');
            countElements.forEach(el => {
                el.textContent = documentCount.toLocaleString();
            });
            
            console.log('Document count from blob storage:', documentCount);
        } else {
            console.error('Failed to fetch blob storage list:', response.status);
            // Set default value on error
            setDefaultCount();
        }
    } catch (error) {
        console.error('Error fetching document count from blob storage:', error);
        setDefaultCount();
    }
}

function setDefaultCount() {
    const countElements = document.querySelectorAll('.document-count, #document-count, #docCount');
    countElements.forEach(el => {
        el.textContent = '0';
    });
}

// Call on page load
document.addEventListener('DOMContentLoaded', updateDocumentCount);

// Also update when window gains focus (in case files were added in another tab)
window.addEventListener('focus', updateDocumentCount);

// Refresh count every 30 seconds if page is visible
setInterval(() => {
    if (!document.hidden) {
        updateDocumentCount();
    }
}, 30000);
