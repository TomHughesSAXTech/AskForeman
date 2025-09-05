# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

1) Common terminal commands

- Frontend (static site):
  - Serve locally (choose one from repo root):
    - python3 -m http.server 5500
    - npx serve .

- Azure Functions (backend) from azure-functions/:
  - cd azure-functions && npm ci && npm start   # runs func start
  - Test endpoints locally:
    - curl http://localhost:7071/api/ping
    - curl -X POST "http://localhost:7071/api/analyze-image?analysisType=construction" \
      -H "Content-Type: application/octet-stream" --data-binary "@/path/to/image.jpg"
    - For functions with authLevel:function (e.g., pdf-chunker, enhanced-search, knowledge-graph), a function key is required in production. Local runs via func start may allow calls without a key depending on local settings.

- Dependencies and scripts:
  - Node/npm (package-lock.json present). No frontend build step.
  - No lint scripts configured.
  - Tests are not configured (azure-functions/package.json test is a placeholder).

- Deployment (GitHub Actions):
  - Static site deploys on push to main via Azure/static-web-apps-deploy (skip_app_build: true). Source and output are repo root.
  - Azure Functions deploys when files under azure-functions/** change via Azure/functions-action using a publish profile secret.
  - Optional CLI deploy (verify target app): from azure-functions/: npm run deploy

2) High-level architecture and structure

- Overview: Static HTML/JS site served by Azure Static Web Apps, plus a separate Node.js Azure Functions app for heavy processing. Several frontend routes proxy to external n8n workflows.

- Frontend (root):
  - Multiple HTML entry points (e.g., index.html, general-chat.html, estimator.html, projects.html, admin.html) and JS under js/ and js/modules/.
  - staticwebapp.config.json defines:
    - Rewrites of /api/webhook/ask-foreman/* to https://workflows.saxtechnology.com/webhook/...
    - Exposes /api/config (anonymous) for frontend runtime configuration.
    - platform.apiRuntime set to node:18.

- API for static site (api/config/):
  - Managed function in Azure Static Web Apps that returns non-sensitive config to the frontend:
    - functionBaseUrl (points to the separate Azure Function App)
    - functionKey (sourced from environment)
    - Named endpoints for analyze-image, pdf-chunker, knowledge-graph, enhanced-search

- Backend (azure-functions/): Node.js Azure Functions app with HTTP triggers:
  - analyze-image (anonymous):
    - Accepts binary or base64 image; uses Azure Computer Vision (REST) for analysis and optional OCR; returns construction-specific data.
  - pdf-chunker (function auth):
    - Splits large PDFs into parts, uploads chunks + metadata to Azure Blob Storage, and triggers indexing via webhook.
  - knowledge-graph (function auth):
    - Extracts entities/relationships using Azure OpenAI; stores graph data in Cosmos DB; updates Azure Cognitive Search with graph metadata and cross-client links.
  - enhanced-search (function auth):
    - Runs Azure Cognitive Search queries (single-client or cross-client), optionally merges knowledge graph results, and can use OpenAI for insights.
  - ping (anonymous): health check.
  - host.json configures HTTP and concurrency; routePrefix is api.

- CI/CD (.github/workflows/):
  - azure-static-web-apps.yml:
    - On push/PR to main, checks out, writes admin-config.js embedding AZURE_FUNCTION_KEY from secrets, then deploys the static site.
  - deploy-azure-functions.yml:
    - On push to main affecting azure-functions/**, deploys that folder to the Function App using the publish profile secret; prints the final Function App URL.

3) Configuration and environment

- Frontend routing and runtime:
  - staticwebapp.config.json controls all public routes and proxy rewrites; platform.apiRuntime is node:18.

- Azure Functions required environment variables (configure in azure-functions/local.settings.json for local runs and in Azure for production):
  - AZURE_STORAGE_CONNECTION_STRING (Blob uploads/metadata)
  - INDEXING_WEBHOOK_URL (optional; defaults to workflows.saxtechnology.com endpoint used in code)
  - COMPUTER_VISION_KEY, COMPUTER_VISION_ENDPOINT
  - SEARCH_ENDPOINT, SEARCH_API_KEY (Azure Cognitive Search)
  - COSMOS_GRAPH_ENDPOINT, COSMOS_GRAPH_KEY (Cosmos DB Graph)
  - OPENAI_API_KEY (if using OpenAI SDK directly)
  - AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY (if using Azure OpenAI SDK)
  - AZURE_SEARCH_ENDPOINT, AZURE_SEARCH_KEY, AZURE_SEARCH_INDEX (optional aliases used in knowledge-graph)

- Static Web App application setting:
  - AZURE_FUNCTION_KEY is configured in the Azure Portal and injected into the deployed site by CI (admin-config.js creation step). Do not commit any keys.

4) Notes and repo-specific gotchas

- The azure-functions/package.json deploy script targets askforeman-functions, while the workflow deploys to SAXTech-DocProcessor. Prefer CI for production; if using CLI deploy, verify and update the target app name.
- No linter or test framework is configured at the repo level; test scripts are placeholders in azure-functions.
- The site is served as static assets; there is no frontend build pipeline here.

