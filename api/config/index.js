// API endpoint to provide configuration to frontend
// This runs on the Static Web App's managed functions

module.exports = async function (context, req) {
    context.log('Config endpoint called');

    // Only provide non-sensitive configuration
    // The function key is injected server-side when needed
    const config = {
        functionBaseUrl: 'https://askforeman-functions.azurewebsites.net/api',
        docProcessorUrl: 'https://saxtech-docprocessor.azurewebsites.net/api',
        functionKey: process.env.AZURE_FUNCTION_KEY || '',
        docProcessorKey: process.env.DOC_PROCESSOR_KEY || process.env.AZURE_FUNCTION_KEY || '',
        endpoints: {
            analyzeImage: '/analyze-image',
            pdfChunker: '/pdf-chunker',
            knowledgeGraph: '/knowledge-graph',
            enhancedSearch: '/enhanced-search',
            blueprintTakeoff: '/BlueprintTakeoffUnified',
            convertDocument: '/ConvertDocumentJson',
            processLargePdf: '/ProcessLargePDF'
        }
    };

    context.res = {
        headers: {
            'Content-Type': 'application/json'
        },
        body: config
    };
};
