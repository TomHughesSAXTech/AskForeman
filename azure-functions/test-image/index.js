// Simple test function to debug image handling
module.exports = async function (context, req) {
    context.log('Test image function triggered');
    
    try {
        // Log request details
        const bodyInfo = {
            hasBody: !!req.body,
            bodyType: typeof req.body,
            bodyIsBuffer: Buffer.isBuffer(req.body),
            bodyLength: req.body ? (req.body.length || JSON.stringify(req.body).length) : 0,
            hasRawBody: !!req.rawBody,
            rawBodyType: typeof req.rawBody,
            rawBodyIsBuffer: Buffer.isBuffer(req.rawBody),
            headers: req.headers,
            contentType: req.headers['content-type']
        };
        
        context.log('Body info:', JSON.stringify(bodyInfo, null, 2));
        
        // Try to create a buffer
        let buffer;
        if (Buffer.isBuffer(req.body)) {
            buffer = req.body;
        } else if (req.rawBody) {
            buffer = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody);
        } else if (req.body) {
            // Try to handle various input types
            if (req.body.type === 'Buffer' && Array.isArray(req.body.data)) {
                buffer = Buffer.from(req.body.data);
            } else if (typeof req.body === 'string') {
                buffer = Buffer.from(req.body, 'base64');
            } else {
                buffer = Buffer.from(req.body);
            }
        }
        
        const response = {
            success: true,
            message: 'Test successful',
            bufferCreated: !!buffer,
            bufferSize: buffer ? buffer.length : 0,
            bodyInfo: bodyInfo,
            envVars: {
                hasComputerVisionKey: !!process.env.COMPUTER_VISION_KEY,
                hasComputerVisionEndpoint: !!process.env.COMPUTER_VISION_ENDPOINT,
                endpoint: process.env.COMPUTER_VISION_ENDPOINT || 'Not set'
            }
        };
        
        context.res = {
            status: 200,
            body: response
        };
        
    } catch (error) {
        context.log.error('Test error:', error);
        context.res = {
            status: 500,
            body: {
                error: 'Test failed',
                message: error.message,
                stack: error.stack
            }
        };
    }
};
