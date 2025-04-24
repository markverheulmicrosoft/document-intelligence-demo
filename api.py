import os
import sys
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient
from dotenv import load_dotenv
import uvicorn
from typing import Dict, Any, List
import tempfile
from pydantic import BaseModel

# Load environment variables from .env file
load_dotenv(override=True)

app = FastAPI(title="Document Intelligence API")

# Add CORS middleware to allow cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Modify this in production to only allow specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalysisResponse(BaseModel):
    words: List[Dict[str, Any]]
    lines: List[Dict[str, Any]]

def get_azure_credentials():
    endpoint = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
    key = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_KEY")
    if not endpoint or not key:
        raise ValueError("Azure Document Intelligence credentials not found.")
    return endpoint, key

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
            for idx, line in enumerate(page.lines):
                text = line.content
                # Each line has a polygon (list of 8 floats: 4 points)
                polygon = line.polygon
                output.append({
                    'page': page_number,
                    'line_index' : idx,
                    'text': text,
                    'polygon': polygon
                })
    print(len(output))
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
    print(len(output))
    return output

@app.get("/")
async def root():
    return {"message": "Welcome to Document Intelligence API"}

@app.post("/analyze-pdf", response_model=AnalysisResponse)
async def analyze_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    try:
        # Get Azure credentials
        endpoint, key = get_azure_credentials()

        # Save the uploaded file to a temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            temp_file.write(await file.read())
            temp_file_path = temp_file.name

        try:
            # Process the document
            result = analyze_document(endpoint, key, temp_file_path)

            # Extract words and lines with coordinates
            lines_coords = extract_text_and_coords(result)
            words_coords = extract_words_and_coords(result)

            # Create a proper response object that matches our model
            response = AnalysisResponse(
                words=words_coords,
                lines=lines_coords
            )

            return response

        finally:
            # Clean up the temporary file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)

    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)