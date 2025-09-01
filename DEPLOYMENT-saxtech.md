# SAXTech - Ask Foreman AI Deployment Documentation

## Generated: 2025-09-01T03:28:38.197Z

## Environment: production

## Configuration Summary

### Azure Resources
- **Storage Account**: saxtechfcs
- **Container**: fcs-clients
- **Search Service**: fcssearchservice
- **Function App**: saxtech-docconverter

### Indexes
- **Primary Index**: fcs-construction-docs-index-v2
- **Vector Index**: fcs-vector-index

### Endpoints
- **Upload**: https://n8n.saxtechnology.com/webhook/ask-foreman/upload
- **Search**: https://n8n.saxtechnology.com/webhook/ask-foreman/search
- **Delete**: https://n8n.saxtechnology.com/webhook/ask-foreman/files/delete

### Processing Limits
- **Max File Size**: 50MB
- **Chunk Threshold**: 10MB
- **Chunk Size**: 5MB

## Deployment Steps

1. **Import Workflow**
   - Open n8n interface
   - Go to Workflows > Import
   - Select `n8n-workflow-saxtech-production.json`

2. **Configure Credentials in n8n**
   - Azure Blob Storage: Add connection string or SAS token
   - HTTP Request nodes: Credentials are embedded

3. **Test Endpoints**
   ```bash
   # Test upload
   curl -X POST https://n8n.saxtechnology.com/webhook/ask-foreman/upload \
     -H "Content-Type: application/json" \
     -d '{"file": "base64_content", "fileName": "test.pdf", "client": "test"}'
   
   # Test search
   curl -X POST https://n8n.saxtechnology.com/webhook/ask-foreman/search \
     -H "Content-Type: application/json" \
     -d '{"query": "test query", "client": "test"}'
   ```

4. **Update Application Configuration**
   - Update webhook URLs in your application
   - Configure CORS if needed
   - Set up monitoring

## Security Checklist
- [ ] API keys are securely stored
- [ ] SAS tokens have appropriate permissions
- [ ] Function keys are not exposed
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] SSL/TLS is enforced

## Monitoring
- Check n8n execution logs
- Monitor Azure Storage metrics
- Review Search Service query analytics
- Track Function App performance

## Support
For issues or questions, refer to the main documentation or contact support.
