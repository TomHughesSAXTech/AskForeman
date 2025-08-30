// API endpoint for serving application configuration
// This file is served by Azure Static Web Apps API routes

module.exports = async function (context, req) {
    // Get the Azure Function key from environment variables
    const azureFunctionKey = process.env.AZURE_FUNCTION_KEY || '';
    
    // Return configuration object
    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        body: {
            azureFunctionKey: azureFunctionKey,
            // Add other configuration items as needed
            functionAppUrl: 'https://saxtech-functionapps2.azurewebsites.net'
        }
    };
};
