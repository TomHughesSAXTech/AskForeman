// Example of how admin.html should call the delete client webhook

async function deleteClient(clientName) {
  try {
    const response = await fetch('https://workflows.saxtechnology.com/webhook/ask-foreman/delete-client', {
      method: 'DELETE',  // or 'POST'
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client: clientName  // Send client name in the body
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Delete client result:', result);
    return result;
  } catch (error) {
    console.error('Error deleting client:', error);
    throw error;
  }
}

// Usage:
// deleteClient('Cooper');
