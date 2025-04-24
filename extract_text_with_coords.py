import os
import sys
from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(override=True)

def analyze_document(endpoint, key, file_path, model_id="prebuilt-layout"):
    document_intelligence_client = DocumentIntelligenceClient(
        endpoint=endpoint,
        credential=AzureKeyCredential(key)
    )
    with open(file_path, "rb") as f:
        poller = document_intelligence_client.begin_analyze_document(
            model_id,
            body=f
        )
    result = poller.result()
    return result

def extract_text_and_coords(result):
    output = []
    for page in result.pages:
        page_number = page.page_number
        if hasattr(page, 'lines') and page.lines:
            for line in page.lines:
                text = line.content
                # Each line has a polygon (list of 8 floats: 4 points)
                polygon = line.polygon
                output.append({
                    'page': page_number,
                    'text': text,
                    'polygon': polygon
                })
    return output

def extract_words_and_coords(result):
    output = []
    for page in result.pages:
        page_number = page.page_number
        if hasattr(page, 'words') and page.words:
            for idx, word in enumerate(page.words):
                text = word.content
                polygon = word.polygon
                output.append({
                    'page': page_number,
                    'word_index': idx,
                    'text': text,
                    'polygon': polygon
                })
    return output

def main():
    input_file = "input.pdf"
    if not os.path.isfile(input_file):
        print(f"Error: PDF file '{input_file}' not found.")
        sys.exit(1)
    endpoint = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
    key = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_KEY")
    if not endpoint or not key:
        print("Error: Azure Document Intelligence credentials not found.")
        sys.exit(1)
    try:
        print(f"Analyzing PDF: {input_file} using model: prebuilt-layout")
        result = analyze_document(endpoint, key, input_file, model_id="prebuilt-layout")
        text_coords = extract_text_and_coords(result)
        for item in text_coords:
            print(f"Page {item['page']}: '{item['text']}' at {item['polygon']}")
        # Print all words with their coordinates
        words_coords = extract_words_and_coords(result)
        for item in words_coords[:10]:
            print(f"Page {item['page']} Word {item['word_index']}: '{item['text']}' at {item['polygon']}")
        # Example: highlight the 3rd word on page 1
        page_x = 1
        word_n = 2  # zero-based index, so 2 is the third word
        word_to_highlight = next((w for w in words_coords if w['page'] == page_x and w['word_index'] == word_n), None)
        if word_to_highlight:
            print(f"\nHighlight example: Page {page_x} Word {word_n+1}: '{word_to_highlight['text']}' at {word_to_highlight['polygon']}")
        else:
            print(f"\nNo word found at page {page_x} index {word_n}")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
