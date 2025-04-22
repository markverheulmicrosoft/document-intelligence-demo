#!/usr/bin/env python3

import os
import sys
from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def analyze_document(endpoint, key, file_path, model_id="prebuilt-document"):
    """
    Analyze a document using Azure Document Intelligence
    Args:
        model_id: The ID of the model to use (e.g., "prebuilt-document", "prebuilt-invoice", "prebuilt-receipt")
    """
    document_intelligence_client = DocumentIntelligenceClient(
        endpoint=endpoint,
        credential=AzureKeyCredential(key)
    )

    # Use the passed model_id
    with open(file_path, "rb") as f:
        poller = document_intelligence_client.begin_analyze_document(
            model_id,
            body=f
        )
    result = poller.result()
    return result


def main():
    input_file = "input.pdf"
    input_file = "input2.pdf"

    # --- CHOOSE YOUR MODEL ID HERE --- 
    # model_to_use = "prebuilt-read" 
    model_to_use = "prebuilt-layout" # Try layout model again
    # model_to_use = "prebuilt-receipt"
    # model_to_use = "prebuilt-invoice" 
    # ----------------------------------

    # Check if the PDF file exists
    if not os.path.isfile(input_file):
        print(f"Error: PDF file '{input_file}' not found.")
        sys.exit(1)
    
    # Get Azure credentials from environment variables
    endpoint = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
    key = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_KEY")
    
    if not endpoint or not key:
        print("Error: Azure Document Intelligence credentials not found.")
        print("Please set the following environment variables:")
        print("  AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
        print("  AZURE_DOCUMENT_INTELLIGENCE_KEY")
        sys.exit(1)
    
    try:
        print(f"Analyzing PDF: {input_file} using model: {model_to_use}")
        result = analyze_document(endpoint, key, input_file, model_id=model_to_use)

        # --- Print Raw Extracted Content (First 500 chars) ---
        print("\n--- Raw Extracted Content (First 500 chars) ---")
        if result.content:
            print(result.content[:500] + ("..." if len(result.content) > 500 else ""))
        else:
            print("No content extracted.")

        # --- Print General Key-Value Pairs (from prebuilt-layout/document) ---
        print("\n--- Extracted Key-Value Pairs ---")
        if result.key_value_pairs:
            for kv_pair in result.key_value_pairs:
                key_content = kv_pair.key.content if kv_pair.key else "N/A"
                value_content = kv_pair.value.content if kv_pair.value else "N/A" # Use .content
                confidence = kv_pair.confidence if kv_pair.confidence is not None else "N/A" # Check confidence exists
                
                print(f"  Key: \"{key_content}\" (Confidence: {confidence})") # Removed formatting if N/A
                print(f"  Value: \"{value_content}\"")
                
                # Print bounding box information for the value
                if kv_pair.value and kv_pair.value.bounding_regions:
                    for region in kv_pair.value.bounding_regions:
                        print(f"    -> Location: Page #{region.page_number}, Box: {region.polygon}")
                else:
                    print("    -> Location: N/A")
                print("---")
        else:
            print("No general key-value pairs found.")

        # --- Print Specific Document Fields (from prebuilt-invoice/receipt etc.) ---
        print("\n--- Extracted Document Fields ---")
        if result.documents:
            for idx, doc in enumerate(result.documents):
                print(f"\nDocument #{idx + 1} (Type: {doc.doc_type}, Confidence: {doc.confidence:.2f}):")
                for name, field in doc.fields.items():
                    # Primarily use field.content for reliable text access
                    field_value_text = field.content if field.content else "N/A" 
                    field_confidence = field.confidence if field.confidence is not None else "N/A" # Check confidence exists

                    print(f"  Field: \"{name}\" (Confidence: {field_confidence})") # Removed formatting if N/A
                    print(f"  Value: \"{field_value_text}\"") 
                    
                    # Optionally check specific types if needed later
                    # if field.type == "date":
                    #    print(f"    Date Value: {field.value_date}")
                    # elif field.type == "number":
                    #     print(f"    Number Value: {field.value_number}")

                    # Print bounding box for specific fields if needed
                    if field.bounding_regions:
                        for region in field.bounding_regions:
                            print(f"    -> Location: Page #{region.page_number}, Box: {region.polygon}")
                    else:
                        print("    -> Location: N/A")
                    print("  ---")
        else:
            print("No specific document fields found (this is expected if using prebuilt-layout/read).")

        print("\nAnalysis complete!")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()