# Azure Document Intelligence PDF Analyzer

This web application uses Azure Document Intelligence to extract structured data from PDF documents and allows users to visually verify the source of extracted information through interactive highlighting.

## Features

- Upload and analyze PDF documents through a web interface
- Extract structured data from invoices, receipts, and other document types
- View the extracted data with confidence scores
- **Interactive verification**: Click on any extracted field to highlight its location in the original PDF
- Responsive design with split-screen view showing both data and document

## Prerequisites

- Python 3.10 or later
- An Azure account with an active subscription
- Azure Document Intelligence resource

## Setup

1. Set up your Azure Document Intelligence resource (instructions below)
2. Clone this repository
3. Create and activate a Python virtual environment:
   ```bash
   python -m venv env
   source env/bin/activate  # On Windows: env\Scripts\activate
   ```
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Create a `.env` file in the project root with your Azure credentials:
   ```
   AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT="your-endpoint-url"
   AZURE_DOCUMENT_INTELLIGENCE_KEY="your-api-key"
   ```

## Usage

1. Start the Flask server:
   ```bash
   source env/bin/activate  # If not already activated
   python app.py
   ```

2. Open your web browser and navigate to:
   ```
   http://localhost:5000
   ```

3. Use the web interface to:
   - Upload a PDF document (or use the default included sample)
   - Click "Analyze Document" to process it
   - View the extracted data on the left side
   - Click on any extracted field to highlight its location in the PDF on the right

## Implementation Details

- **Backend**: Flask application (`app.py`) that handles API requests and serves static files
- **Frontend**: HTML/JavaScript application with PDF.js for rendering PDFs and drawing highlights
- **Azure Integration**: Uses Azure Document Intelligence SDK to analyze documents and extract data with bounding boxes

## Sample Data

The repository includes:
- `input.pdf`: A non-sensitive sample invoice for testing the application
- `create_sample_invoice.py`: A utility script that generates the sample invoice using ReportLab

You can create additional sample invoices by running:
```bash
python create_sample_invoice.py
```

## Customization

You can modify the `model_id` in `app.py` to use different Document Intelligence models:
- `prebuilt-invoice` (default): Optimized for invoices
- `prebuilt-receipt`: For receipts
- `prebuilt-document`: For general documents
- `prebuilt-layout`: For understanding document structure
- Custom model IDs: If you've trained custom models in Azure Document Intelligence Studio

## Setting up Azure Document Intelligence Resource

1. Sign in to the [Azure portal](https://portal.azure.com)
2. Click on "Create a resource"
3. Search for "Document Intelligence" and select it
4. Click "Create"
5. Fill in the required details:
   - **Subscription**: Select your Azure subscription
   - **Resource group**: Create a new one or use an existing group
   - **Region**: Select a region near you
   - **Name**: Give your resource a unique name
   - **Pricing tier**: Free (limited usage) or Standard tier
6. Click "Review + create" and then "Create"
7. After deployment, go to the resource
8. Navigate to "Keys and Endpoint" in the left menu
9. Copy the endpoint URL and one of the keys to use in your `.env` file

## License

This project is licensed under the MIT License - see the LICENSE file for details.