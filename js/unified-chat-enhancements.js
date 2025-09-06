// Unified Chat Enhancements
// This script provides consistent chat functionality across all pages
// Including fly-in notifications, screenshot handling, and context awareness

(function() {
    'use strict';
    
    // Configuration
    const TEMP_CONTAINER = 'temp-chat-screenshots';
    const AZURE_STORAGE = {
        account: "saxtechfcs",
        container: TEMP_CONTAINER,
        sasToken: "?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D"
    };
    
    // Shared chat context across all pages
    window.sharedChatContext = {
        screenshots: [],
        currentPage: window.location.pathname.split('/').pop() || 'index.html',
        sessionId: sessionStorage.getItem('chatSessionId') || generateSessionId(),
        messages: JSON.parse(sessionStorage.getItem('chatHistory') || '[]')
    };
    
    // Store session ID
    sessionStorage.setItem('chatSessionId', window.sharedChatContext.sessionId);
    
    function generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // 1. Add System Message Functionality (Fly-in notifications)
    window.addSystemMessage = function(message, type = 'info') {
        // Create or get message container
        let messageContainer = document.getElementById('systemMessages');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'systemMessages';
            messageContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10002;
                max-width: 350px;
                pointer-events: none;
            `;
            document.body.appendChild(messageContainer);
        }
        
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = 'system-message';
        messageEl.style.cssText = `
            background: ${type === 'error' ? 'linear-gradient(135deg, #f44336, #d32f2f)' : 
                         type === 'success' ? 'linear-gradient(135deg, #4caf50, #388e3c)' : 
                         type === 'warning' ? 'linear-gradient(135deg, #ff9800, #f57c00)' :
                         'linear-gradient(135deg, #2196f3, #1976d2)'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            margin-bottom: 0.75rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-size: 0.95rem;
            pointer-events: auto;
            cursor: pointer;
            position: relative;
            overflow: hidden;
        `;
        
        // Add icon based on type
        const icon = type === 'error' ? '❌' : 
                     type === 'success' ? '✅' : 
                     type === 'warning' ? '⚠️' : 
                     'ℹ️';
        
        messageEl.innerHTML = `
            <span style="font-size: 1.2rem;">${icon}</span>
            <span style="flex: 1;">${message}</span>
            <span style="opacity: 0.7; font-size: 0.8rem;">✕</span>
        `;
        
        // Add progress bar
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            height: 3px;
            background: rgba(255, 255, 255, 0.3);
            animation: shrink 3s linear;
            width: 100%;
        `;
        messageEl.appendChild(progressBar);
        
        messageContainer.appendChild(messageEl);
        
        // Click to dismiss
        messageEl.onclick = function() {
            messageEl.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => messageEl.remove(), 300);
        };
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => messageEl.remove(), 300);
            }
        }, 3000);
    };
    
    // 2. Enhanced Screenshot Handling for Chat
    window.setupEnhancedScreenshotHandling = function() {
        // Find all chat input areas
        const chatInputs = document.querySelectorAll('#chatInput, #projectChatInput, input[type="text"][placeholder*="Type"]');
        
        chatInputs.forEach(input => {
            // Add paste event listener
            input.addEventListener('paste', handleScreenshotPaste);
        });
        
        // Also add to document for global paste handling
        document.addEventListener('paste', function(e) {
            // Check if we're in a chat context
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.id === 'chatInput' || 
                                 activeElement.id === 'projectChatInput' ||
                                 activeElement.classList.contains('chat-input'))) {
                handleScreenshotPaste(e);
            }
        });
    };
    
    async function handleScreenshotPaste(e) {
        const items = e.clipboardData?.items;
        if (!items) return;
        
        for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const blob = item.getAsFile();
                await uploadScreenshot(blob);
            }
        }
    }
    
    async function uploadScreenshot(blob) {
        try {
            // Show uploading status
            addSystemMessage('📸 Uploading screenshot...', 'info');
            
            // Generate unique filename
            const fileName = `screenshot_${window.sharedChatContext.sessionId}_${Date.now()}.png`;
            
            // Convert blob to base64
            const reader = new FileReader();
            reader.onloadend = async function() {
                const base64Data = reader.result.split(',')[1];
                
                // Upload to temp container via Azure
                const uploadUrl = `https://${AZURE_STORAGE.account}.blob.core.windows.net/${AZURE_STORAGE.container}/${fileName}${AZURE_STORAGE.sasToken}`;
                
                try {
                    const response = await fetch(uploadUrl, {
                        method: 'PUT',
                        headers: {
                            'x-ms-blob-type': 'BlockBlob',
                            'Content-Type': 'image/png'
                        },
                        body: blob
                    });
                    
                    if (response.ok) {
                        // Store screenshot reference
                        const screenshotData = {
                            url: uploadUrl.split('?')[0],
                            fileName: fileName,
                            timestamp: new Date().toISOString(),
                            page: window.sharedChatContext.currentPage
                        };
                        
                        window.sharedChatContext.screenshots.push(screenshotData);
                        sessionStorage.setItem('chatScreenshots', JSON.stringify(window.sharedChatContext.screenshots));
                        
                        // Update chat input to show screenshot attached
                        updateChatInputWithScreenshot(fileName);
                        
                        // Show success
                        addSystemMessage('✅ Screenshot attached to message', 'success');
                        
                        // Clean up old screenshots (older than 24 hours)
                        cleanupOldScreenshots();
                    } else {
                        throw new Error('Upload failed');
                    }
                } catch (error) {
                    console.error('Screenshot upload error:', error);
                    addSystemMessage('❌ Failed to upload screenshot', 'error');
                }
            };
            
            reader.readAsDataURL(blob);
            
        } catch (error) {
            console.error('Screenshot handling error:', error);
            addSystemMessage('❌ Error processing screenshot', 'error');
        }
    }
    
    function updateChatInputWithScreenshot(fileName) {
        // Find active chat input
        const chatInput = document.getElementById('chatInput') || 
                         document.getElementById('projectChatInput') ||
                         document.querySelector('.chat-input.active');
        
        if (chatInput) {
            // Add visual indicator
            let attachmentIndicator = document.getElementById('attachmentIndicator');
            if (!attachmentIndicator) {
                attachmentIndicator = document.createElement('div');
                attachmentIndicator.id = 'attachmentIndicator';
                attachmentIndicator.style.cssText = `
                    position: absolute;
                    top: -30px;
                    left: 0;
                    background: linear-gradient(135deg, #4caf50, #388e3c);
                    color: white;
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                `;
                chatInput.parentElement.style.position = 'relative';
                chatInput.parentElement.appendChild(attachmentIndicator);
            }
            
            attachmentIndicator.innerHTML = `
                📎 ${window.sharedChatContext.screenshots.length} screenshot(s) attached
                <span onclick="clearScreenshots()" style="cursor: pointer; margin-left: 0.5rem;">✕</span>
            `;
        }
    }
    
    window.clearScreenshots = function() {
        window.sharedChatContext.screenshots = [];
        sessionStorage.removeItem('chatScreenshots');
        const indicator = document.getElementById('attachmentIndicator');
        if (indicator) indicator.remove();
        addSystemMessage('Screenshots cleared', 'info');
    };
    
    async function cleanupOldScreenshots() {
        // Clean up screenshots older than 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const currentScreenshots = window.sharedChatContext.screenshots;
        const validScreenshots = [];
        
        for (let screenshot of currentScreenshots) {
            const screenshotDate = new Date(screenshot.timestamp);
            if (screenshotDate > oneDayAgo) {
                validScreenshots.push(screenshot);
            } else {
                // Delete old screenshot from Azure
                try {
                    await fetch(screenshot.url + AZURE_STORAGE.sasToken, {
                        method: 'DELETE'
                    });
                } catch (error) {
                    console.log('Error cleaning up old screenshot:', error);
                }
            }
        }
        
        window.sharedChatContext.screenshots = validScreenshots;
        sessionStorage.setItem('chatScreenshots', JSON.stringify(validScreenshots));
    }
    
    // 3. Update Focus On Feature for Projects Page
    window.updateFocusOnFeature = function() {
        // Replace the existing "focus on" message in chat with fly-in notification
        const originalFocusOn = window.focusOnItem || window.setFocus;
        
        if (originalFocusOn) {
            window.focusOnItem = function(item, type) {
                // Call original if needed
                if (typeof originalFocusOn === 'function') {
                    originalFocusOn(item, type);
                }
                
                // Show fly-in notification instead of chat message
                let message = '';
                let icon = '';
                
                switch(type) {
                    case 'file':
                        icon = '📁';
                        message = `Focusing on: ${item}`;
                        break;
                    case 'project':
                        icon = '🏗️';
                        message = `Selected project: ${item}`;
                        break;
                    case 'document':
                        icon = '📄';
                        message = `Viewing document: ${item}`;
                        break;
                    default:
                        icon = '🎯';
                        message = `Focus: ${item}`;
                }
                
                addSystemMessage(`${icon} ${message}`, 'info');
            };
            
            window.setFocus = window.focusOnItem;
        }
    };
    
    // 4. Context-Aware Chat Enhancement
    window.enhanceChatContext = function() {
        // Add context to all chat messages
        const originalSendMessage = window.sendMessage || window.sendChatMessage;
        
        if (originalSendMessage) {
            window.sendMessage = async function(message) {
                // Enhance message with context
                const enhancedMessage = {
                    text: message,
                    context: {
                        page: window.sharedChatContext.currentPage,
                        sessionId: window.sharedChatContext.sessionId,
                        screenshots: window.sharedChatContext.screenshots,
                        timestamp: new Date().toISOString(),
                        project: document.getElementById('clientSelect')?.value || 
                                document.getElementById('projectSelect')?.value || 
                                'none',
                        activeTab: document.querySelector('.tab-btn.active')?.textContent || 'none'
                    }
                };
                
                // Store in session history
                window.sharedChatContext.messages.push(enhancedMessage);
                sessionStorage.setItem('chatHistory', JSON.stringify(window.sharedChatContext.messages));
                
                // Call original send function
                if (typeof originalSendMessage === 'function') {
                    await originalSendMessage(message);
                }
                
                // Clear screenshots after sending
                if (window.sharedChatContext.screenshots.length > 0) {
                    window.clearScreenshots();
                }
            };
            
            window.sendChatMessage = window.sendMessage;
        }
    };
    
    // 5. Add CSS Animations
    function addAnimationStyles() {
        if (!document.getElementById('chatEnhancementStyles')) {
            const style = document.createElement('style');
            style.id = 'chatEnhancementStyles';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
                
                @keyframes shrink {
                    from {
                        width: 100%;
                    }
                    to {
                        width: 0%;
                    }
                }
                
                .system-message:hover {
                    transform: translateX(-5px);
                    transition: transform 0.2s ease;
                }
                
                #attachmentIndicator {
                    animation: slideIn 0.3s ease;
                }
                
                .chat-context-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.25rem 0.5rem;
                    background: rgba(33, 150, 243, 0.1);
                    border-radius: 12px;
                    font-size: 0.75rem;
                    color: #2196f3;
                    margin-left: 0.5rem;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // 6. Initialize on DOM ready
    function initialize() {
        console.log('🚀 Initializing unified chat enhancements...');
        
        // Add animation styles
        addAnimationStyles();
        
        // Setup screenshot handling
        setupEnhancedScreenshotHandling();
        
        // Update focus on feature for projects page
        if (window.location.pathname.includes('projects')) {
            updateFocusOnFeature();
        }
        
        // Enhance chat context
        enhanceChatContext();
        
        // Load existing screenshots from session
        const savedScreenshots = sessionStorage.getItem('chatScreenshots');
        if (savedScreenshots) {
            window.sharedChatContext.screenshots = JSON.parse(savedScreenshots);
            if (window.sharedChatContext.screenshots.length > 0) {
                updateChatInputWithScreenshot();
            }
        }
        
        // Make addSystemMessage globally available if not already
        window.addSystemMessage = window.addSystemMessage || addSystemMessage;
        
        console.log('✅ Chat enhancements initialized successfully');
        
        // Show initialization message
        if (window.location.pathname.includes('projects')) {
            setTimeout(() => {
                addSystemMessage('🚀 Project Management Ready', 'success');
            }, 500);
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
})();
