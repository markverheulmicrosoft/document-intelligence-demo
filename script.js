// Get references to DOM elements
const fileInput = document.getElementById('fileInput');
const selectFileButton = document.getElementById('selectFileButton'); // New button
const currentFileNameSpan = document.getElementById('currentFileName'); // Span for filename
const analyzeButton = document.getElementById('analyzeButton');
const statusDiv = document.getElementById('status');
const extractedDataContainer = document.getElementById('extractedDataContainer'); // New reference
const pdfCanvas = document.getElementById('pdfCanvas');
const pdfViewerContainer = document.getElementById('pdfViewerContainer');
const ctx = pdfCanvas.getContext('2d');

let currentPdfDoc = null;
let currentFile = null; // Will hold the File or Blob object
let currentPageNum = 1; // Start with page 1
let pageRendering = false;
let pageNumPending = null;
const scale = 1.5; // Adjust scale for rendering quality/size
let dummyAnalysisResult = null; // Store result to redraw highlights on page change

/**
 * Get page info from document, resize canvas accordingly, and render page.
 * @param {number} pageNum Page number.
 */
async function renderPage(pageNum) {
    if (!currentPdfDoc) return;
    pageRendering = true;

    // Using promise to fetch the page
    const page = await currentPdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: scale });
    pdfCanvas.height = viewport.height;
    pdfCanvas.width = viewport.width;

    // Render PDF page into canvas context
    const renderContext = {
        canvasContext: ctx,
        viewport: viewport
    };
    const renderTask = page.render(renderContext);

    // Wait for rendering to finish
    await renderTask.promise;
    pageRendering = false;
    if (pageNumPending !== null) {
        // New page rendering is pending
        renderPage(pageNumPending);
        pageNumPending = null;
    }
    // Update status or UI if needed
    statusDiv.textContent = `Page ${pageNum} rendered.`;

    // After rendering, potentially redraw highlights if analysis was already done
    clearHighlights(); // Clear old ones first
    if (dummyAnalysisResult) { // Check if analysis result exists
        drawHighlights(dummyAnalysisResult); // Redraw based on stored result
    }
}

/**
 * If another page rendering in progress, waits until the rendering is
 * finished. Otherwise, executes rendering immediately.
 */
function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

/**
 * Loads and renders a PDF from a File or Blob object.
 * @param {File|Blob} fileObject The PDF file or blob.
 * @param {string} fileName The name to display.
 */
async function loadAndRenderPdf(fileObject, fileName) {
    currentFile = fileObject;
    currentFileNameSpan.textContent = `Current: ${fileName}`;
    statusDiv.textContent = 'Loading PDF...';
    extractedDataContainer.innerHTML = 'No data yet.'; // Clear formatted results
    clearHighlights(); // Clear highlights
    dummyAnalysisResult = null; // Reset analysis result

    const fileReader = new FileReader();
    fileReader.onload = async function () {
        const typedarray = new Uint8Array(this.result);
        try {
            const loadingTask = pdfjsLib.getDocument({ data: typedarray });
            currentPdfDoc = await loadingTask.promise;
            statusDiv.textContent = `PDF loaded (${currentPdfDoc.numPages} pages). Rendering page 1...`;
            currentPageNum = 1;
            renderPage(currentPageNum); // Render the first page
        } catch (reason) {
            console.error('Error during PDF loading/rendering: ', reason);
            statusDiv.textContent = `Error loading PDF: ${reason.message}`;
            currentFileNameSpan.textContent = `Error loading ${fileName}`;
        }
    };
    fileReader.onerror = () => {
        statusDiv.textContent = `Error reading file ${fileName}.`;
        currentFileNameSpan.textContent = `Error reading ${fileName}`;
    }
    fileReader.readAsArrayBuffer(fileObject);
}

// --- Default PDF Loading ----
document.addEventListener('DOMContentLoaded', async () => {
    statusDiv.textContent = 'Fetching default PDF (input2.pdf)...';
    try {
        // Fetch the local PDF file relative to index.html
        const response = await fetch('input2.pdf');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const pdfBlob = await response.blob();
        loadAndRenderPdf(pdfBlob, 'input2.pdf'); // Load and render the fetched blob
    } catch (error) {
        console.error('Error fetching default PDF:', error);
        statusDiv.textContent = 'Error loading default PDF. Please select one manually.';
        currentFileNameSpan.textContent = 'No file loaded.';
    }
});

// --- Event Listeners ---

// Trigger hidden file input when "Change PDF" button is clicked
selectFileButton.addEventListener('click', () => {
    fileInput.click();
});

// Handle file selection via the input element
fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
        // statusDiv.textContent = 'Please select a PDF file.'; // Keep previous status if selection cancelled
        return;
    }
    loadAndRenderPdf(file, file.name); // Load the newly selected file
});

// Analyze button remains the same
analyzeButton.addEventListener('click', () => {
    if (!currentFile) {
        statusDiv.textContent = 'Please select or load a PDF file first.';
        return;
    }
    // In a real app, you would send 'currentFile' (which could be a File or Blob)
    // to your backend here using FormData and fetch()
    simulateBackendAnalysis(currentFile);
});

/**
 * Clears any existing highlight divs.
 */
function clearHighlights() {
    const existingHighlights = pdfViewerContainer.querySelectorAll('.highlight');
    existingHighlights.forEach(h => h.remove());
}

/**
 * Draws highlights on the PDF viewer based on bounding box data.
 * @param {object} analysisResult - The result object containing fields and bounding boxes.
 */
function drawHighlights(analysisResult) {
    clearHighlights();
    if (!analysisResult || !currentPdfDoc) return; // Check for analysisResult and pdfDoc

    // Use stored currentPageNum
    currentPdfDoc.getPage(currentPageNum).then(page => {
        const viewport = page.getViewport({ scale: scale });

        // Check if analysisResult.documents exists and is an array
        if (analysisResult.documents && Array.isArray(analysisResult.documents)) {
            analysisResult.documents.forEach(doc => {
                // Check if doc.fields exists
                if (doc.fields) {
                    Object.values(doc.fields).forEach(field => {
                        if (field.boundingRegions) {
                            field.boundingRegions.forEach(region => {
                                // Only draw highlights for the currently rendered page
                                if (region.pageNumber === currentPageNum) {
                                    const polygon = region.polygon; // Array of numbers [x0, y0, x1, y1, ...]

                                    if (polygon && polygon.length >= 8) {
                                        // Find min/max x/y from the polygon points
                                        let minX = polygon[0], maxX = polygon[0];
                                        let minY = polygon[1], maxY = polygon[1];
                                        for (let i = 2; i < polygon.length; i += 2) {
                                            minX = Math.min(minX, polygon[i]);
                                            maxX = Math.max(maxX, polygon[i]);
                                            minY = Math.min(minY, polygon[i + 1]);
                                            maxY = Math.max(maxY, polygon[i + 1]);
                                        }

                                        // Convert PDF coordinates (inches/points) to canvas pixels
                                        const topLeft = viewport.convertToViewportPoint(minX, maxY);
                                        const bottomRight = viewport.convertToViewportPoint(maxX, minY);

                                        const highlight = document.createElement('div');
                                        highlight.className = 'highlight';
                                        highlight.style.left = `${topLeft[0]}px`;
                                        highlight.style.top = `${topLeft[1]}px`;
                                        highlight.style.width = `${bottomRight[0] - topLeft[0]}px`;
                                        highlight.style.height = `${bottomRight[1] - topLeft[1]}px`;
                                        pdfViewerContainer.appendChild(highlight);
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
        // Add similar logic here to iterate through result.key_value_pairs if needed

    }).catch(error => {
        console.error("Error getting page for highlighting:", error);
    });
}

/**
 * Formats and displays the analysis results in a more readable way.
 * @param {object} analysisResult - The result object from Document Intelligence.
 */
function displayFormattedResults(analysisResult) {
    extractedDataContainer.innerHTML = ''; // Clear previous results

    if (!analysisResult || !analysisResult.documents || !Array.isArray(analysisResult.documents)) {
        extractedDataContainer.textContent = 'No analysis results available.';
        return;
    }

    analysisResult.documents.forEach(doc => {
        const docDiv = document.createElement('div');
        docDiv.className = 'document-result';

        const docType = document.createElement('h3');
        docType.textContent = `Document Type: ${doc.docType}`;
        docDiv.appendChild(docType);

        const confidence = document.createElement('p');
        confidence.textContent = `Confidence: ${doc.confidence}`;
        docDiv.appendChild(confidence);

        if (doc.fields) {
            const fieldsDiv = document.createElement('div');
            fieldsDiv.className = 'fields-container';

            Object.entries(doc.fields).forEach(([fieldName, fieldData]) => {
                const fieldDiv = document.createElement('div');
                fieldDiv.className = 'field-result';

                const fieldNameSpan = document.createElement('span');
                fieldNameSpan.className = 'field-name';
                fieldNameSpan.textContent = `${fieldName}: `;
                fieldDiv.appendChild(fieldNameSpan);

                const fieldContentSpan = document.createElement('span');
                fieldContentSpan.className = 'field-content';
                fieldContentSpan.textContent = fieldData.content;
                fieldDiv.appendChild(fieldContentSpan);

                fieldsDiv.appendChild(fieldDiv);
            });

            docDiv.appendChild(fieldsDiv);
        }

        extractedDataContainer.appendChild(docDiv);
    });
}

// --- SIMULATED BACKEND INTERACTION ---

async function simulateBackendAnalysis(file) {
    statusDiv.textContent = 'Analyzing document (simulation)...';
    extractedDataContainer.innerHTML = 'Analyzing...'; // Show analyzing state

    await new Promise(resolve => setTimeout(resolve, 1500));

    // --- Dummy Data (Using coordinates from your input2.pdf example) ---
    dummyAnalysisResult = {
        documents: [
            {
                docType: "invoice",
                confidence: 1.00,
                fields: {
                    "InvoiceDate": {
                        content: "30 januari 2025",
                        confidence: 0.806,
                        boundingRegions: [{ pageNumber: 1, polygon: [6.6034, 0.6427, 7.3387, 0.6391, 7.3393, 0.7609, 6.604, 0.7644] }]
                    },
                    "InvoiceTotal": {
                        content: "£ 24,32",
                        confidence: 0.771,
                        boundingRegions: [{ pageNumber: 1, polygon: [6.8308, 2.0152, 7.3401, 2.02, 7.3387, 2.1777, 6.8294, 2.1729] }]
                    },
                    "VendorName": {
                        content: "Uber",
                        confidence: 0.568,
                        boundingRegions: [{ pageNumber: 1, polygon: [0.9024, 0.541, 1.5077, 0.5443, 1.5077, 0.8051, 0.9012, 0.7995] }]
                    }
                }
            }
        ]
    };
    // --- End Dummy Data ---

    statusDiv.textContent = 'Analysis complete (simulation). Click location to highlight.';
    displayFormattedResults(dummyAnalysisResult); // Display the formatted results

    clearHighlights(); // Ensure no highlights are shown initially after analysis
}

// TODO: Add basic pagination controls (optional)
// e.g., buttons for previous/next page that call queueRenderPage(newPageNum)
// and update currentPageNum. Remember to redraw highlights after page change.