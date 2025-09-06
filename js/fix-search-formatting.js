// Fix Web Search Result Formatting
// Fixes the broken HTML display in search results

(function() {
    'use strict';
    
    // Override the processMessageContent function to fix search result formatting
    const originalProcessMessageContent = window.processMessageContent;
    
    window.processMessageContent = function(content, attachments) {
        let processedContent = content;
        
        // Fix broken HTML in search results
        // Replace escaped HTML with proper HTML
        processedContent = processedContent.replace(/&lt;/g, '<');
        processedContent = processedContent.replace(/&gt;/g, '>');
        processedContent = processedContent.replace(/&quot;/g, '"');
        processedContent = processedContent.replace(/&#39;/g, "'");
        processedContent = processedContent.replace(/&amp;/g, '&');
        
        // Fix broken link formatting from search results
        // Pattern: https://example.com" target="_blank" style="..."> Link Text
        processedContent = processedContent.replace(
            /https?:\/\/[^"]+"\s*target="_blank"\s*style="[^"]+"\s*&gt;\s*([^<]+)/gi,
            function(match, linkText) {
                const url = match.match(/(https?:\/\/[^"]+)/)[1];
                return `<a href="${url}" target="_blank" style="color: #1565c0; text-decoration: underline;">${linkText}</a>`;
            }
        );
        
        // Fix search result formatting
        processedContent = processedContent.replace(
            /🔗\s*([^<\n]+)\n\s*https?:\/\/[^\s]+/gi,
            function(match) {
                const lines = match.split('\n');
                const title = lines[0].replace('🔗', '').trim();
                const url = lines[1].trim();
                return `<div style="margin: 10px 0; padding: 10px; background: #f5f5f5; border-left: 3px solid #1565c0; border-radius: 4px;">
                    <div style="font-weight: bold; margin-bottom: 5px;">🔗 ${title}</div>
                    <a href="${url}" target="_blank" style="color: #1565c0; text-decoration: none; word-break: break-all;">${url}</a>
                </div>`;
            }
        );
        
        // Fix bullet points with links
        processedContent = processedContent.replace(
            /\*\s*🔗\s*([^:]+):\s*(https?:\/\/[^\s]+)([^*]*)/gi,
            function(match, title, url, description) {
                return `<li style="margin: 10px 0;">
                    <strong>🔗 ${title}:</strong><br/>
                    <a href="${url}" target="_blank" style="color: #1565c0; text-decoration: none;">${url}</a>
                    ${description ? `<br/><span style="color: #666;">${description.trim()}</span>` : ''}
                </li>`;
            }
        );
        
        // Wrap unordered lists properly
        if (processedContent.includes('<li') && !processedContent.includes('<ul')) {
            processedContent = processedContent.replace(
                /(<li[^>]*>.*?<\/li>)+/gs,
                '<ul style="list-style: none; padding-left: 0;">$&</ul>'
            );
        }
        
        // Fix tips and info formatting
        processedContent = processedContent.replace(
            /\*\s*(Tip|ℹ️ Info):\s*([^*\n]+)/gi,
            '<div style="margin: 10px 0; padding: 10px; background: #e3f2fd; border-left: 3px solid #2196f3; border-radius: 4px;"><strong>$1:</strong> $2</div>'
        );
        
        // Call original function if it exists for additional processing
        if (originalProcessMessageContent && typeof originalProcessMessageContent === 'function') {
            processedContent = originalProcessMessageContent.call(this, processedContent, attachments);
        }
        
        return processedContent;
    };
    
    console.log('✅ Search formatting fix loaded');
})();
