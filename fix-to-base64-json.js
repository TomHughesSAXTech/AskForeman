#!/usr/bin/env node

const fs = require('fs');

console.log('=== Converting HTML files to send base64 JSON (matching n8n expectations) ===\n');

// Fix index.html
console.log('Fixing index.html...');
let indexContent = fs.readFileSync('index.html', 'utf8');

// Find and replace the processFile function
const processFileStart = indexContent.indexOf('async function processFile(file, category)');
const processFileEnd = indexContent.indexOf('// Chat Functionality', processFileStart);

if (processFileStart !== -1 && processFileEnd !== -1) {
  const newProcessFile = `async function processFile(file, category) {
        // Convert file to base64 for n8n webhook
        const reader = new FileReader();
        
        return new Promise((resolve, reject) => {
          reader.onload = async () => {
            try {
              // Get base64 string (remove data:type;base64, prefix)
              const base64String = reader.result.split(',')[1];
              
              // Send as JSON with base64-encoded file
              const uploadData = {
                file: base64String,
                fileName: file.name,
                mimeType: file.type || 'application/pdf',
                category: category,
                client: selectedClient || 'general',
                clientName: selectedClient || 'General'
              };
              
              const response = await fetch(API_CONFIG.uploadWebhookUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(uploadData)
              });

              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(\`HTTP \${response.status}: \${errorText}\`);
              }

              const result = await response.json();
              resolve(result);
            } catch (error) {
              console.error("Error processing file:", error);
              reject(error);
            }
          };
          
          reader.onerror = () => {
            reject(new Error(\`Failed to read file: \${file.name}\`));
          };
          
          // Read file as base64
          reader.readAsDataURL(file);
        });
      }

      `;
  
  indexContent = indexContent.substring(0, processFileStart) + 
                 newProcessFile + 
                 indexContent.substring(processFileEnd);
  
  fs.writeFileSync('index.html', indexContent);
  console.log('✅ index.html updated to send base64 JSON\n');
}

// Fix admin.html
console.log('Fixing admin.html...');
let adminContent = fs.readFileSync('admin.html', 'utf8');

// Find and replace the uploadFilesWithCategories function
const uploadStart = adminContent.indexOf('async function uploadFilesWithCategories()');
const uploadEnd = adminContent.indexOf('function clearFileSelection()', uploadStart);

if (uploadStart !== -1 && uploadEnd !== -1) {
  const newUploadFunction = `async function uploadFilesWithCategories() {
            if (!selectedFiles || selectedFiles.length === 0) {
                showStatus('error', 'No files selected');
                return;
            }
            
            if (!selectedClient) {
                showStatus('error', 'Please select a client first');
                return;
            }
            
            showLoading(\`Uploading and converting \${selectedFiles.length} files...\`);
            
            let successCount = 0;
            let errorCount = 0;
            const errors = [];
            
            // Use n8n webhook for upload and conversion
            const uploadWebhookUrl = 'https://workflows.saxtechnology.com/webhook/ask-foreman/upload';
            
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                const fileName = file.name;
                
                // Get category from dropdown
                const categorySelect = document.getElementById(\`fileCategory_\${i}\`);
                const category = categorySelect ? categorySelect.value : 'drawings';
                
                try {
                    console.log(\`Uploading \${fileName} to category: \${category}\`);
                    console.log('Selected client:', selectedClient);
                    
                    // Convert file to base64
                    const base64Data = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            // Extract base64 string (remove data URL prefix)
                            const base64String = reader.result.split(',')[1];
                            resolve(base64String);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    
                    // Create JSON payload matching n8n expectations
                    const uploadData = {
                        file: base64Data,
                        fileName: fileName,
                        mimeType: file.type || 'application/pdf',
                        category: category,
                        client: selectedClient.folder || selectedClient.name,
                        clientName: selectedClient.folder || selectedClient.name
                    };
                    
                    // Send to n8n webhook as JSON
                    const uploadResponse = await fetch(uploadWebhookUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(uploadData)
                    });
                    
                    if (uploadResponse.ok) {
                        const result = await uploadResponse.json();
                        console.log(\`Successfully uploaded \${fileName}:\`, result);
                        successCount++;
                    } else {
                        const errorText = await uploadResponse.text();
                        console.error(\`Failed to upload \${fileName}:\`, errorText);
                        errors.push(\`\${fileName}: \${errorText}\`);
                        errorCount++;
                    }
                } catch (error) {
                    console.error(\`Error uploading \${fileName}:\`, error);
                    errors.push(\`\${fileName}: \${error.message}\`);
                    errorCount++;
                }
                
                document.getElementById('loadingText').textContent = \`Processing file \${i + 1} of \${selectedFiles.length}...\`;
            }
            
            hideLoading();
            
            // Show results
            let message = '';
            if (successCount > 0) {
                message = \`✅ Successfully uploaded and converted \${successCount} file(s). They will be indexed for search.\`;
            }
            if (errorCount > 0) {
                message += \`\\n⚠️ \${errorCount} file(s) failed to upload.\`;
                if (errors.length > 0) {
                    console.error('Upload errors:', errors);
                }
            }
            
            showStatus(errorCount > 0 ? 'warning' : 'success', message);
            
            // Clear selection and hide preview
            clearFileSelection();
            
            // Reload documents after a delay to allow conversion
            setTimeout(() => {
                loadClientDocuments();
            }, 2000);
        }
        
        // Clear file selection
        `;
  
  adminContent = adminContent.substring(0, uploadStart) + 
                 newUploadFunction + 
                 adminContent.substring(uploadEnd);
  
  fs.writeFileSync('admin.html', adminContent);
  console.log('✅ admin.html updated to send base64 JSON\n');
}

console.log('=== Summary ===');
console.log('Both HTML files now send base64 JSON matching n8n workflow expectations:');
console.log('{\n  file: "base64_string",\n  fileName: "document.pdf",\n  mimeType: "application/pdf",\n  category: "specs",\n  client: "client-name",\n  clientName: "client-name"\n}');
console.log('\nThis matches what your "Prepare Client Data" node expects.');
