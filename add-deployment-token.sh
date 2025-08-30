#!/bin/bash

echo "==================================="
echo "Azure Static Web Apps Deployment Setup"
echo "==================================="
echo ""
echo "Your code has been pushed to GitHub!"
echo "Repository: https://github.com/TomHughesSAXTech/AskForeman"
echo ""
echo "To complete the deployment:"
echo ""
echo "1. Get your Azure Static Web Apps deployment token:"
echo "   - Go to https://portal.azure.com"
echo "   - Find your Static Web App resource"
echo "   - Click 'Manage deployment token' in the Overview page"
echo "   - Copy the token"
echo ""
echo "2. Run this command with your token:"
echo ""
echo "   gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN"
echo ""
echo "   (It will prompt you to paste the token)"
echo ""
echo "3. Or add it manually at:"
echo "   https://github.com/TomHughesSAXTech/AskForeman/settings/secrets/actions/new"
echo "   - Name: AZURE_STATIC_WEB_APPS_API_TOKEN"
echo "   - Value: [your token]"
echo ""
echo "Once added, the deployment will trigger automatically!"
echo ""
echo "Would you like to add the token now? (y/n)"
read -r response

if [[ "$response" == "y" || "$response" == "Y" ]]; then
    echo "Paste your Azure Static Web Apps deployment token and press Enter:"
    gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN
    echo ""
    echo "Token added! Triggering deployment..."
    git commit --allow-empty -m "Trigger deployment"
    git push origin main
    echo ""
    echo "Deployment triggered! Check the status at:"
    echo "https://github.com/TomHughesSAXTech/AskForeman/actions"
else
    echo ""
    echo "You can add the token later using the instructions above."
fi
