/**
 * Fix for missing functions on estimator.html page
 * This file defines all the missing functions that are called by buttons
 */

// Ensure functions are globally available
(function() {
    'use strict';

    // Fix for openEstimatorForm
    window.openEstimatorForm = function() {
        // Create a professional estimator modal
        const modal = document.createElement('div');
        modal.id = 'estimatorFormModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 12px;
                padding: 2rem;
                width: 90%;
                max-width: 600px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            ">
                <h2 style="margin: 0 0 1rem 0; color: #333;">Professional Estimator</h2>
                <p style="color: #666; margin-bottom: 1.5rem;">
                    The Professional Estimator is launching. This feature provides comprehensive estimate building capabilities.
                </p>
                <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                    <button onclick="document.getElementById('estimatorFormModal').remove()" style="
                        padding: 0.75rem 1.5rem;
                        background: #6c757d;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    ">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Also add a message to the chat
        if (typeof addSystemMessage === 'function') {
            addSystemMessage('📊 Professional Estimator opened. Use the form to build comprehensive estimates.');
        }
    };

    // Fix for openCostCalculator - already defined in estimator.html but may not be in scope
    if (typeof window.openCostCalculator === 'undefined') {
        window.openCostCalculator = function() {
            // Send a message to the chat to invoke the cost calculator
            const chatInput = document.getElementById('chatInput');
            const sendButton = document.getElementById('sendButton');
            
            if (chatInput && sendButton) {
                // Set the message to trigger the calculator
                chatInput.value = "Open the construction cost calculator";
                
                // Send the message
                if (typeof sendMessage === 'function') {
                    sendMessage();
                } else if (sendButton.click) {
                    sendButton.click();
                }
                
                // Clear the input after a short delay
                setTimeout(() => {
                    chatInput.value = '';
                }, 100);
                
                // Provide feedback
                if (typeof addSystemMessage === 'function') {
                    addSystemMessage('🧮 Requesting Construction Cost Calculator from the AI assistant...');
                }
            } else {
                alert('Chat system is not available. Please refresh the page.');
            }
        };
    }

    // Fix for openDigitalTakeoffAssistant - should already exist but ensure it's available
    if (typeof window.openDigitalTakeoffAssistant === 'undefined') {
        window.openDigitalTakeoffAssistant = function() {
            // Check if the enhanced takeoff is available
            if (window.initializeDigitalTakeoff) {
                window.initializeDigitalTakeoff();
            } else {
                // Fallback message
                const modal = document.createElement('div');
                modal.id = 'takeoffFallbackModal';
                modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                `;
                
                modal.innerHTML = `
                    <div style="
                        background: white;
                        border-radius: 12px;
                        padding: 2rem;
                        width: 90%;
                        max-width: 600px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    ">
                        <h2 style="margin: 0 0 1rem 0; color: #333;">📐 Digital Takeoff Assistant</h2>
                        <p style="color: #666; margin-bottom: 1.5rem;">
                            The Digital Takeoff Assistant is loading. This advanced feature provides:
                        </p>
                        <ul style="color: #666; margin-bottom: 1.5rem;">
                            <li>Blueprint annotation and editing</li>
                            <li>Automatic area calculations</li>
                            <li>Highlight detection</li>
                            <li>Azure AI integration</li>
                        </ul>
                        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                            <button onclick="document.getElementById('takeoffFallbackModal').remove()" style="
                                padding: 0.75rem 1.5rem;
                                background: #2E86AB;
                                color: white;
                                border: none;
                                border-radius: 5px;
                                cursor: pointer;
                            ">Got it</button>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal);
            }
        };
    }

    // Ensure sendMessage function is available globally
    if (typeof window.sendMessage === 'undefined') {
        window.sendMessage = async function() {
            const chatInput = document.getElementById('chatInput');
            const sendButton = document.getElementById('sendButton');
            const chatMessages = document.getElementById('chatMessages');
            const typingIndicator = document.getElementById('typingIndicator');
            
            const message = chatInput.value.trim();
            if (!message) return;
            
            // Add user message
            const userMessageDiv = document.createElement('div');
            userMessageDiv.className = 'message user';
            userMessageDiv.innerHTML = `
                <div class="message-content">
                    <div class="formatted-content">${message}</div>
                    <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            `;
            
            if (typingIndicator && typingIndicator.parentNode === chatMessages) {
                chatMessages.insertBefore(userMessageDiv, typingIndicator);
            } else {
                chatMessages.appendChild(userMessageDiv);
            }
            
            // Clear input
            chatInput.value = '';
            
            // Show typing indicator
            if (typingIndicator) {
                typingIndicator.classList.add('active');
            }
            
            try {
                // Use the webhook URL
                const webhookUrl = window.API_CONFIG?.chatWebhookUrl || 
                                  'https://workflows.saxtechnology.com/webhook/ask-foreman/chat';
                
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: message,
                        context: window.chatContext || 'estimator',
                        sessionId: window.selectedClient || 'estimator'
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const data = await response.json();
                
                // Hide typing indicator
                if (typingIndicator) {
                    typingIndicator.classList.remove('active');
                }
                
                // Add assistant response
                const assistantMessageDiv = document.createElement('div');
                assistantMessageDiv.className = 'message assistant';
                assistantMessageDiv.innerHTML = `
                    <div class="message-avatar">🤖</div>
                    <div class="message-content">
                        <div class="formatted-content">${formatContent(data.response || 'I apologize, but I couldn\'t generate a response. Please try again.')}</div>
                        <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                `;
                
                if (typingIndicator && typingIndicator.parentNode === chatMessages) {
                    chatMessages.insertBefore(assistantMessageDiv, typingIndicator);
                } else {
                    chatMessages.appendChild(assistantMessageDiv);
                }
                
                // Scroll to bottom
                chatMessages.scrollTop = chatMessages.scrollHeight;
                
            } catch (error) {
                console.error('Chat error:', error);
                
                // Hide typing indicator
                if (typingIndicator) {
                    typingIndicator.classList.remove('active');
                }
                
                // Add error message
                const errorDiv = document.createElement('div');
                errorDiv.className = 'message assistant';
                errorDiv.innerHTML = `
                    <div class="message-avatar">⚠️</div>
                    <div class="message-content" style="background: #fee;">
                        <div class="formatted-content">Sorry, I encountered an error. Please try again.</div>
                        <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                `;
                
                if (typingIndicator && typingIndicator.parentNode === chatMessages) {
                    chatMessages.insertBefore(errorDiv, typingIndicator);
                } else {
                    chatMessages.appendChild(errorDiv);
                }
                
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        };
    }

    // Ensure addSystemMessage is available
    if (typeof window.addSystemMessage === 'undefined') {
        window.addSystemMessage = function(content) {
            const chatMessages = document.getElementById('chatMessages');
            if (!chatMessages) return;
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant';
            messageDiv.innerHTML = `
                <div class="message-avatar">⚙️</div>
                <div class="message-content" style="background: linear-gradient(135deg, #ffc107, #f57f17); color: #212121;">
                    <div class="formatted-content"><strong>${content}</strong></div>
                    <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            `;
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        };
    }

    // Ensure formatContent is available
    if (typeof window.formatContent === 'undefined') {
        window.formatContent = function(content) {
            if (!content) return '';
            content = String(content);
            
            // Basic formatting
            content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            content = content.replace(/\*(.+?)\*/g, '<em>$1</em>');
            content = content.replace(/`(.+?)`/g, '<code style="background: #f6f8fa; padding: 2px 6px; border-radius: 3px;">$1</code>');
            content = content.replace(/\n/g, '<br>');
            
            return content;
        };
    }

    console.log('✅ Estimator functions fix loaded successfully');
})();
