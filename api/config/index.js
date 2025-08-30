// API endpoint for serving application configuration
// This file is served by Azure Static Web Apps API routes

module.exports = async function (context, req) {
    // Get the Azure Function key from environment variables
    // Use the correct key for the delete client function
    const azureFunctionKey = process.env.AZURE_FUNCTION_KEY || 'KRitpiKC4_teemeHVrLWt8-vJdIvpSkzBFW0co3J4Q3FAzFuYbOMng==';
    
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
            functionAppUrl: 'https://saxtech-docconverter.azurewebsites.net'
        }
    };
};
