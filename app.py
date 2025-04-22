# Create app.py
import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeResult
from dotenv import load_dotenv
import logging
import io  # Import io module for reading stream

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes, allowing requests from the frontend

# Get Azure credentials from environment variables
AZURE_ENDPOINT = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
AZURE_KEY = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_KEY")

if not AZURE_ENDPOINT or not AZURE_KEY:
    logger.error("Azure Document Intelligence credentials not found in environment variables.")
    # You might want to exit or handle this more gracefully depending on deployment
    # For now, the endpoint will return an error if credentials are missing

# --- Static File Serving ---

@app.route('/')
def serve_index():
    """Serves the index.html file."""
    logger.info("Serving index.html")
    # Serve index.html from the same directory as app.py
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static_files(filename):
    """Serves static files like JS, CSS, PDF from the root directory."""
    logger.info(f"Attempting to serve static file: {filename}")
    # Security: Limit allowed file types or use a dedicated 'static' folder in production
    if filename.endswith('.js') or filename.endswith('.pdf') or filename.endswith('.css'):
         # Serve allowed files from the same directory as app.py
        return send_from_directory('.', filename)
    else:
        logger.warning(f"Attempt to access disallowed file type: {filename}")
        return "File not found", 404 # Or handle as appropriate

def analyze_document_stream(file_stream, model_id="prebuilt-document"):
    """
    Analyze a document stream using Azure Document Intelligence.
    Args:
        file_stream: The file-like object (stream) containing the document data.
        model_id: The ID of the model to use.
    Returns:
        AnalyzeResult object or raises an exception on error.
    """
    if not AZURE_ENDPOINT or not AZURE_KEY:
        raise ValueError("Azure credentials are not configured.")

    logger.info(f"Analyzing document using model: {model_id}")
    try:
        document_intelligence_client = DocumentIntelligenceClient(
            endpoint=AZURE_ENDPOINT,
            credential=AzureKeyCredential(AZURE_KEY)
        )

        # Read the stream content into bytes
        file_bytes = file_stream.read()
        logger.info(f"Read {len(file_bytes)} bytes from stream.")

        poller = document_intelligence_client.begin_analyze_document(
            model_id,
            body=file_bytes, # Pass the actual bytes
            content_type="application/octet-stream"
        )
        result = poller.result()
        logger.info("Analysis successful.")
        return result
    except Exception as e:
        logger.error(f"Error during Document Intelligence analysis: {e}", exc_info=True)
        raise # Re-raise the exception to be caught by the route handler

def convert_analyze_result_to_dict(analyze_result: AnalyzeResult) -> dict:
    """
    Converts the AnalyzeResult object to a JSON-serializable dictionary.
    Handles potential complexities like nested objects and non-serializable types.
    """
    if not analyze_result:
        return {}

    # Basic serialization - you might need to expand this based on the fields you use
    # This example focuses on documents and their fields/bounding regions
    output = {
        "api_version": analyze_result.api_version,
        "model_id": analyze_result.model_id,
        "content": analyze_result.content, # Be mindful of large content size
        "pages": [],
        "tables": [],
        "key_value_pairs": [],
        "styles": [],
        "languages": [],
        "documents": []
    }

    # Serialize pages (basic info)
    if analyze_result.pages:
        for page in analyze_result.pages:
             output["pages"].append({
                 "page_number": page.page_number,
                 "angle": page.angle,
                 "width": page.width,
                 "height": page.height,
                 "unit": page.unit,
                 # Add lines, words if needed, carefully handling bounding boxes
             })

    # Serialize documents and their fields
    if analyze_result.documents:
        for doc in analyze_result.documents:
            doc_dict = {
                "doc_type": doc.doc_type,
                "bounding_regions": [],
                "spans": [{"offset": span.offset, "length": span.length} for span in doc.spans] if doc.spans else [],
                "confidence": doc.confidence,
                "fields": {}
            }
            if doc.bounding_regions:
                 for region in doc.bounding_regions:
                     doc_dict["bounding_regions"].append({
                         "page_number": region.page_number,
                         "polygon": region.polygon # Already a list of numbers
                     })

            if doc.fields:
                for name, field in doc.fields.items():
                    field_dict = {
                        "type": field.type,
                        "value": None, # Placeholder
                        "content": field.content,
                        "bounding_regions": [],
                        "spans": [{"offset": span.offset, "length": span.length} for span in field.spans] if field.spans else [],
                        "confidence": field.confidence
                    }
                    # Handle different field value types
                    if field.type == "string":
                        field_dict["value"] = field.value_string
                    elif field.type == "date":
                        field_dict["value"] = field.value_date.isoformat() if field.value_date else None
                    elif field.type == "time":
                        field_dict["value"] = field.value_time.isoformat() if field.value_time else None
                    elif field.type == "phone_number":
                         field_dict["value"] = field.value_phone_number
                    elif field.type == "number":
                         field_dict["value"] = field.value_number
                    elif field.type == "integer":
                         field_dict["value"] = field.value_integer
                    elif field.type == "selection_mark":
                         field_dict["value"] = field.value_selection_mark
                    elif field.type == "country_region":
                         field_dict["value"] = field.value_country_region
                    elif field.type == "signature":
                         field_dict["value"] = field.value_signature
                    elif field.type == "list":
                         # Recursively convert list items if they are complex
                         field_dict["value"] = [item.content for item in field.value_list] # Simple example
                    elif field.type == "dictionary":
                         # Recursively convert dictionary items if they are complex
                         field_dict["value"] = {k: v.content for k, v in field.value_dictionary.items()} # Simple example
                    # Add other types as needed (currency, address, boolean, etc.)

                    if field.bounding_regions:
                        for region in field.bounding_regions:
                            field_dict["bounding_regions"].append({
                                "page_number": region.page_number,
                                "polygon": region.polygon
                            })
                    doc_dict["fields"][name] = field_dict
            output["documents"].append(doc_dict)

    # Add serialization for tables, key_value_pairs, styles, languages if needed

    return output


@app.route('/analyze', methods=['POST'])
def handle_analyze():
    """
    Flask route to handle document analysis requests.
    Expects a POST request with a file part named 'document'.
    """
    if 'document' not in request.files:
        logger.warning("No 'document' file part in the request.")
        return jsonify({"error": "No file part named 'document' found"}), 400

    file = request.files['document']

    if file.filename == '':
        logger.warning("No selected file.")
        return jsonify({"error": "No selected file"}), 400

    if file:
        try:
            # --- CHOOSE MODEL ID ---
            # You could pass this from the frontend if needed, e.g., via query param or another form field
            # model_id = request.args.get('modelId', 'prebuilt-invoice')
            model_id = "prebuilt-invoice" # Defaulting to invoice for now
            # ---------------------

            # Pass the file stream directly
            analyze_result = analyze_document_stream(file.stream, model_id=model_id)

            # Convert the result object to a JSON-serializable dictionary
            result_dict = convert_analyze_result_to_dict(analyze_result)

            return jsonify(result_dict)

        except ValueError as ve: # Catch specific error for missing credentials
             logger.error(f"Configuration error: {ve}")
             return jsonify({"error": str(ve)}), 500
        except Exception as e:
            logger.error(f"An error occurred during analysis: {e}", exc_info=True)
            # Return a generic error message to the client for security
            return jsonify({"error": "An internal server error occurred during analysis."}), 500
    else:
        # This case should ideally be caught by the checks above, but included for completeness
        logger.warning("File object was present but invalid.")
        return jsonify({"error": "Invalid file"}), 400

if __name__ == '__main__':
    # Use host='0.0.0.0' to make it accessible on your network if needed
    # Debug=True is helpful during development but should be False in production
    logger.info("Starting Flask server to handle API and static files...")
    app.run(debug=True, host='0.0.0.0', port=5000)