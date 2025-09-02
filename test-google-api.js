// Test Google Custom Search API directly
const https = require('https');

const apiKey = 'AIzaSyCZRgUZ07vV_5tigSHCNFkpL1pF9ERxwWM';
const cx = '269ca898373084b47';
const query = 'OSHA 2025 rules';

const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=5`;

console.log('Testing Google Search API...');
console.log('URL:', url);

https.get(url, (response) => {
    let data = '';
    
    response.on('data', (chunk) => {
        data += chunk;
    });
    
    response.on('end', () => {
        try {
            const result = JSON.parse(data);
            
            console.log('\n=== API Response Structure ===');
            console.log('Response keys:', Object.keys(result));
            
            if (result.error) {
                console.error('\nAPI Error:', result.error);
                return;
            }
            
            if (result.items) {
                console.log(`\nFound ${result.items.length} results\n`);
                
                // Show structure of first item
                if (result.items[0]) {
                    console.log('First item structure:');
                    console.log('Keys:', Object.keys(result.items[0]));
                    console.log('\nFirst result details:');
                    console.log('Title:', result.items[0].title);
                    console.log('Link:', result.items[0].link);
                    console.log('Snippet:', result.items[0].snippet);
                    
                    // Show full first item for debugging
                    console.log('\nFull first item (for debugging):');
                    console.log(JSON.stringify(result.items[0], null, 2));
                }
                
                console.log('\n=== All Results ===');
                result.items.forEach((item, index) => {
                    console.log(`\n${index + 1}. ${item.title}`);
                    console.log(`   URL: ${item.link}`);
                    console.log(`   Snippet: ${item.snippet || 'No snippet'}`);
                });
            } else {
                console.log('No items found in response');
                console.log('Full response:', JSON.stringify(result, null, 2));
            }
            
        } catch (error) {
            console.error('Error parsing response:', error);
            console.log('Raw response:', data);
        }
    });
}).on('error', (error) => {
    console.error('Request error:', error);
});
