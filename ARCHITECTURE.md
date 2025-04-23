# Architecture: Azure Document Intelligence PDF Analyzer

This document outlines the architecture of the PDF Analyzer web application, which extracts data from PDF documents and enables users to visually verify the source of the extracted information within the original document.

## 1. System Overview

The application consists of a Flask backend and HTML/JavaScript frontend with the following key components:

![Architecture Overview: Frontend (HTML/JS/PDF.js) ←→ Backend (Flask) ←→ Azure Document Intelligence]

### Components

1. **Frontend**
   - HTML/JavaScript-based web interface
   - PDF.js for PDF rendering and highlighting
   - Split-screen UI showing extracted data and PDF document

2. **Backend**
   - Flask web server providing:
     - Static file serving (HTML, JavaScript, default PDFs)
     - RESTful API endpoint for document analysis
   - Direct file processing (no intermediate blob storage)

3. **Azure Document Intelligence**
   - Cloud-based document analysis service
   - Provides structured data extraction with bounding box coordinates
   - Uses the prebuilt invoice model by default

## 2. Data Flow

1. **Document Upload & Rendering**
   - User uploads a PDF or uses the default document
   - Frontend loads the PDF using PDF.js
   - Document is rendered in the PDF viewer area

2. **Document Analysis**
   - User initiates analysis by clicking "Analyze Document"
   - Frontend sends the PDF to the backend via an AJAX POST request
   - Backend processes the PDF using Azure Document Intelligence
   - Backend converts the results to a JSON-serializable format
   - Structured data (including field values and bounding box coordinates) is returned to the frontend

3. **Visualization & Verification**
   - Frontend displays the extracted fields in a structured format
   - When a user clicks on an extracted field, the application:
     - Retrieves the bounding box coordinates for that field
     - Renders the appropriate page of the PDF
     - Draws a highlight overlay on the PDF using the coordinates

## 3. Key Technologies

### Frontend

- **HTML/CSS**: Basic structure and styling
- **JavaScript**: Core application logic
- **PDF.js**: Mozilla's PDF rendering library
- **Fetch API**: For HTTP requests to the backend

### Backend

- **Flask**: Python web framework
- **Flask-CORS**: Cross-Origin Resource Sharing support
- **Azure SDK for Python**: Communication with Azure Document Intelligence

### Cloud Services

- **Azure Document Intelligence**: Document analysis with the following capabilities:
  - Text extraction with positional data
  - Field identification and classification
  - Confidence scoring
  - Bounding box/polygon coordinates for visual mapping

## 4. Coordinate System & Highlighting

A key technical aspect of this application is the coordinate conversion between different systems:

1. **Azure Document Intelligence Coordinates**:
   - Returned as polygons in the response
   - Based on inches from the top-left corner of the page
   - Format: `[x1, y1, x2, y2, x3, y3, x4, y4]` (four corners of a quadrilateral)

2. **PDF Coordinate System**:
   - PDF.js uses "PDF points" (1/72 inch) with origin at bottom-left
   - Conversion from Azure coordinates requires:
     - Multiplying by 72 (converting inches to points)
     - Flipping the Y-axis (Azure: top-down, PDF: bottom-up)

3. **Canvas Coordinate System**:
   - Final drawing happens on an HTML canvas
   - PDF.js viewport handles conversion from PDF points to canvas pixels

The `handleLocationClick` function in `script.js` implements this coordinate transformation to accurately highlight text regions.

## 5. Error Handling

- **Frontend**: Form validation, HTTP error handling, and user feedback
- **Backend**: Exception handling with appropriate HTTP status codes
- **Logging**: Comprehensive logging for debugging and monitoring

## 6. Future Improvements

Potential enhancements to consider:

1. **Multi-page Support**: Enhanced navigation for multi-page documents
2. **Model Selection**: Frontend UI option to choose different document intelligence models
3. **Persistence**: Storing analysis results for future reference
4. **Security Enhancements**: Additional validation, authentication, and authorization
5. **Batched Processing**: Support for analyzing multiple documents

## 7. Implementation Files

- **app.py**: Flask server with API endpoints and document analysis
- **index.html**: Main web interface
- **script.js**: Frontend logic for PDF rendering and data interaction
