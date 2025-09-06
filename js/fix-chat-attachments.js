// Fix Chat Attachment Context - Ensures uploaded files are properly sent to webhooks
// This fixes the issue where chatbot has no contextual knowledge about uploaded files/images

(function() {
    'use strict';
    
    // Store original sendMessage functions to wrap them
    const originalSendMessage = window.sendMessage;
    
    // Enhanced sendMessage that includes attachment context
    window.sendMessage = async function() {
        const chatInput = document.getElementById('chatInput');
        const chatMessages = document.getElementById('chatMessages');
        
        if (!chatInput || !chatMessages) return;
        
        let message = chatInput.value.trim();
        const hasAttachments = window.attachedImages && window.attachedImages.length > 0;
        
        // If no message but has attachments, create context message
        if (!message && hasAttachments) {
            message = "Please analyze the attached document(s) and provide insights.";
        }
        
        if (!message && !hasAttachments) return;
        
        // Add user message with attachments
        const userDiv = document.createElement('div');
        userDiv.className = 'message user';
        
        let messageHTML = `<div class="message-content">`;
        
        // Show attached files in user message
        if (hasAttachments) {
            messageHTML += `<div style="margin-bottom: 10px;">`;
            window.attachedImages.forEach(att => {
                if (att.type && att.type.startsWith('image/')) {
                    messageHTML += `<img src="${att.url}" style="max-width: 200px; max-height: 200px; border-radius: 8px; margin-right: 10px;" />`;
                } else {
                    messageHTML += `<div style="display: inline-block; padding: 5px 10px; background: rgba(0,0,0,0.1); border-radius: 4px; margin-right: 10px;">📎 ${att.name}</div>`;
                }
            });
            messageHTML += `</div>`;
        }
        
        messageHTML += `
            <div>${message}</div>
            <div class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        </div>
        <div class="message-avatar">👷</div>`;
        
        userDiv.innerHTML = messageHTML;
        chatMessages.appendChild(userDiv);
        
        // Clear input
        chatInput.value = '';
        
        // Add typing indicator
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant typing-indicator-message';
        const avatarImg = window.location.pathname.includes('estimator') ? 'Estimate.png' : 
                         window.location.pathname.includes('projects') ? 'pm.png' : 'general.png';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <img src="${avatarImg}" alt="AI" />
            </div>
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        `;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        try {
            // First, upload attachments to get URLs
            let uploadedAttachments = [];
            
            if (hasAttachments) {
                for (const att of window.attachedImages) {
                    try {
                        // Extract base64 data
                        const base64Data = att.url.split(',')[1];
                        
                        // Upload to blob storage
                        const uploadResponse = await fetch('https://workflows.saxtechnology.com/webhook/ask-foreman/upload', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                file: base64Data,
                                fileName: att.name,
                                mimeType: att.type,
                                client: window.selectedClient || 'general',
                                category: 'chat-attachments',
                                isTemporary: true
                            })
                        });
                        
                        if (uploadResponse.ok) {
                            const result = await uploadResponse.json();
                            uploadedAttachments.push({
                                url: result.url || result.fileUrl,
                                name: att.name,
                                type: att.type,
                                size: att.size
                            });
                        }
                    } catch (error) {
                        console.error('Error uploading attachment:', error);
                    }
                }
            }
            
            // Build enhanced message with document context
            let enhancedMessage = message;
            if (uploadedAttachments.length > 0) {
                // Add document context to message
                const docContext = uploadedAttachments.map(att => {
                    const fileType = att.name.split('.').pop().toUpperCase();
                    return `[Attached ${fileType}: ${att.name}]`;
                }).join(' ');
                
                enhancedMessage = `${message}\n\nContext: ${docContext}\nPlease analyze the attached files and incorporate them into your response.`;
                
                // Add file URLs for the AI to access
                enhancedMessage += '\n\nAttached files:\n' + uploadedAttachments.map(att => 
                    `- ${att.name}: ${att.url}`
                ).join('\n');
            }
            
            // Determine webhook URL based on page
            let webhookUrl = 'https://workflows.saxtechnology.com/webhook/ask-foreman/';
            if (window.location.pathname.includes('estimator')) {
                webhookUrl += 'estimator';
            } else if (window.location.pathname.includes('projects')) {
                webhookUrl += 'PMchat';
            } else {
                webhookUrl += 'chat';
            }
            
            // Send to webhook with full context
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: enhancedMessage,
                    client: window.selectedClient || '',
                    conversationId: `conv_${Date.now()}`,
                    sessionId: window.sessionId || 'default',
                    attachments: uploadedAttachments,
                    hasAttachments: uploadedAttachments.length > 0,
                    attachmentCount: uploadedAttachments.length
                })
            });
            
            const data = await response.json();
            
            // Remove typing indicator
            typingDiv.remove();
            
            // Add assistant response
            const assistantDiv = document.createElement('div');
            assistantDiv.className = 'message assistant';
            assistantDiv.innerHTML = `
                <div class="message-avatar">
                    <img src="${avatarImg}" alt="AI" />
                </div>
                <div class="message-content">
                    <div>${data.response || 'I received your message but could not generate a response.'}</div>
                    <div class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
            `;
            chatMessages.appendChild(assistantDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
        } catch (error) {
            console.error('Chat error:', error);
            typingDiv.remove();
            
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message assistant';
            errorDiv.innerHTML = `
                <div class="message-avatar">⚠️</div>
                <div class="message-content" style="background: #ffebee; color: #c62828;">
                    <div>Sorry, I encountered an error. Please try again.</div>
                    <div class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
            `;
            chatMessages.appendChild(errorDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } finally {
            // Clear attachments after sending
            window.attachedImages = [];
            const previewContainer = document.getElementById('imagePreviewContainer');
            if (previewContainer) {
                previewContainer.remove();
            }
        }
    };
    
    // Initialize attachment array if not exists
    window.attachedImages = window.attachedImages || [];
    
    console.log('✅ Chat attachment context fix loaded');
})();
