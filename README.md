# Azure Document Intelligence PDF Reader

This tool uses Azure Document Intelligence to extract text and structure from PDF documents and convert them to Markdown format.

## Prerequisites

- Python 3.10 or later
- An Azure account with an active subscription
- Azure Document Intelligence resource

## Setup

1. Set up your Azure Document Intelligence resource (instructions below)
2. Install dependencies:
   ```
   source env/bin/activate
   pip install azure-ai-documentintelligence azure-core
   ```

3. Set up your Azure Document Intelligence credentials as environment variables:
   ```
   export AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT="your-endpoint-url"
   export AZURE_DOCUMENT_INTELLIGENCE_KEY="your-api-key"
   ```

## Usage

1. Place your PDF file in the project directory with the name `input.pdf`
2. Run the script:
   ```bash
   source env/bin/activate
   python main.py
   ```
3. The output will be saved as `output.md` in the same directory

## Features

- Extracts text content from PDF documents
- Preserves paragraph structure
- Converts tables to Markdown table format
- Organizes content by page

## Setting up Azure Document Intelligence Resource

1. Sign in to the [Azure portal](https://portal.azure.com)
2. Click on "Create a resource"
3. Search for "Document Intelligence" and select it
4. Click "Create"
5. Fill in the following details:
   - **Subscription**: Select your Azure subscription
   - **Resource group**: Create a new one or use an existing group
   - **Region**: Select a region near you
   - **Name**: Give your resource a unique name
   - **Pricing tier**: Free or Standard tier (depending on your needs)
6. Click "Review + create" and then "Create"
7. After deployment completes, go to the resource
8. Navigate to "Keys and Endpoint" in the left menu
9. Copy the endpoint URL and one of the keys
10. Set these as environment variables as shown in the Setup section

## License

This project is licensed under the MIT License - see the LICENSE file for details.