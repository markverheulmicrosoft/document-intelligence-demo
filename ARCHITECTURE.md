# Solution Design: PDF Data Extraction and Visual Source Linking

This document outlines the recommended architecture for building a web application that extracts data from uploaded PDF documents and allows users to visually verify the source of the extracted information within the original PDF.

## 1. Goal

The primary goal is to create a user-friendly web interface where:

1.  Users can upload PDF documents.
2.  Specific data points (entities, key-value pairs) are automatically extracted from the PDF.
3.  The extracted data is presented to the user (e.g., in form fields).
4.  Users can easily see *where* in the original PDF document a specific piece of extracted data came from, ideally by highlighting the source text/area directly on a view of the PDF.
5.  The solution must be production-stable, scalable, and leverage Azure services where possible, minimizing reliance on complex third-party tools.

## 2. Recommended Approach: Azure Document Intelligence + Frontend PDF Rendering

The most effective way to achieve the goal, especially the visual source linking, is to combine:

*   **Azure Document Intelligence:** For robust data extraction *and* obtaining precise location information (bounding boxes).
*   **Frontend PDF Rendering with Highlighting:** Using a JavaScript library like PDF.js to display the PDF in the browser and draw highlights based on the coordinates provided by Document Intelligence.

## 3. Why Azure Document Intelligence?

While other LLMs *could* extract text, Azure Document Intelligence is the superior choice for this specific task because:

*   **Purpose-Built:** It's specifically designed and optimized for understanding document layouts, structures (tables, forms), and extracting data accurately.
*   **Bounding Box Coordinates:** This is the critical feature. Document Intelligence returns the exact pixel coordinates (bounding boxes or polygons) and page numbers for every piece of text, key, value, table cell, etc., it identifies. This is essential for accurately drawing highlights on the PDF view.
*   **Production Stability & Scalability:** As a managed Azure PaaS offering, it's built for production workloads, handles scaling automatically, and is maintained by Microsoft.
*   **Prebuilt & Custom Models:** Offers powerful prebuilt models (like `prebuilt-document` for general forms, `prebuilt-invoice`, `prebuilt-receipt`, etc.) and the ability to train custom models tailored to specific document layouts for maximum accuracy.
*   **Integration:** Seamlessly integrates with other Azure services (Functions, Logic Apps, Blob Storage).

Using a general-purpose LLM might struggle to consistently provide the precise coordinate information needed for reliable visual highlighting.

## 4. Architecture Overview

![Architecture Diagram Placeholder - A diagram would show Frontend -> Backend API -> Blob Storage & Doc Intelligence -> Frontend with PDF.js]

*   **Frontend:**
    *   Web application (React, Angular, Vue, Blazor, HTML/JS).
    *   Handles user interaction, file uploads.
    *   Integrates a PDF viewer library (e.g., **PDF.js**).
*   **Backend API:**
    *   Hosted on **Azure Functions** (recommended for cost-efficiency and event-driven processing) or **Azure App Service**.
    *   Receives PDF uploads from the frontend.
    *   Orchestrates the analysis process.
    *   Communicates with Azure Blob Storage and Document Intelligence.
*   **Azure Blob Storage:**
    *   Securely stores uploaded PDF files.
    *   Provides URLs (potentially SAS URLs) for Document Intelligence and the frontend PDF viewer to access the files.
*   **Azure Document Intelligence:**
    *   The core analysis engine.
    *   Receives analysis requests from the backend API (pointing to the PDF in Blob Storage).
    *   Returns structured data including text content, key-value pairs, entities, tables, and their bounding box coordinates.
*   **PDF Viewer Library (Frontend):**
    *   **PDF.js** (Mozilla): Recommended. Open-source, widely used, robust, minimal external dependencies. Renders PDF pages in the browser.
    *   Provides APIs to draw custom overlays (highlights) on the rendered PDF canvas using the coordinates from Document Intelligence.

## 5. Workflow

1.  **Upload:** User uploads a PDF via the frontend.
2.  **Store:** Frontend sends the PDF to the Backend API, which uploads it to Azure Blob Storage.
3.  **Analyze:** Backend API triggers Azure Document Intelligence analysis, providing the appropriate `model_id` (for this use case, this will typically be a **custom model ID** obtained after training in Document Intelligence Studio) and the Blob Storage location of the PDF.
4.  **Extract:** Document Intelligence processes the PDF and returns a JSON result containing extracted data (text, tables, specific fields defined in the custom model, etc.) and corresponding bounding box coordinates/page numbers to the Backend API.
5.  **Format:** Backend API processes the result, extracts the required data points and their locations, and sends this structured information back to the frontend.
6.  **Display:** Frontend populates input fields with the extracted data.
7.  **Render PDF:** Frontend uses PDF.js to load the PDF (from Blob Storage) and display it.
8.  **Highlight:** When the user interacts with a data field (e.g., clicks an icon), the frontend uses the associated bounding box coordinates and page number to instruct PDF.js to draw a highlight rectangle/polygon on the displayed PDF page at the precise location of the source data.

## 6. Proof of Concept (`main.py`)

The `main.py` script in this repository serves as a basic proof of concept demonstrating a core capability required for this architecture:

*   It shows how to call the Document Intelligence SDK with different model IDs.
*   Crucially, it demonstrates that the analysis result (whether from layout, prebuilt, or a custom model) contains the necessary **`page_number` and `polygon` (bounding box coordinates)** alongside the extracted text/values.

This location data is the key to enabling the frontend (using a library like PDF.js) to implement the visual highlighting feature, linking extracted data back to its precise source on the PDF page.

```
# Example Output Snippet showing location data:
Value: "$500.00"
  -> Location: Page #1, Box: [500.0, 700.0, 580.0, 700.0, 580.0, 715.0, 500.0, 715.0]
```
