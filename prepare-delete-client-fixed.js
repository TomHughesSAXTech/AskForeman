// Extract client name - handles multiple input formats
const input = $input.first();
const json = input.json;

// Debug: Log what we're receiving
console.log('Input data:', JSON.stringify(json, null, 2));

// Try to extract client from various possible locations
const client = json.body?.client 
  || json.body?.clientName
  || json.client 
  || json.clientName
  || json.query?.client
  || json.params?.client
  || json.headers?.client;

if (!client) {
  // Log the full input for debugging
  console.error('No client found in input:', json);
  throw new Error('Client name is required. Received: ' + JSON.stringify(json));
}

return {
  json: {
    client: client
  }
};
