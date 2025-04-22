// Get references to DOM elements
const fileInput = document.getElementById('fileInput');
const analyzeButton = document.getElementById('analyzeButton');
const statusDiv = document.getElementById('status');
const extractedDataDiv = document.getElementById('extractedData');
const pdfCanvas = document.getElementById('pdfCanvas');
const pdfViewerContainer = document.getElementById('pdfViewerContainer');
const ctx = pdfCanvas.getContext('2d');

let currentPdfDoc = null;
let currentFile = null;
let currentPageNum = 1; // Start with page 1
let pageRendering = false;
let pageNumPending = null;
const scale = 1.5; // Adjust scale for rendering quality/size

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
 * Displays the selected PDF file in the canvas.
 */
fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
        statusDiv.textContent = 'Please select a PDF file.';
        return;
    }
    currentFile = file;
    statusDiv.textContent = 'Loading PDF...';
    extractedDataDiv.textContent = 'No data yet.'; // Reset data
    clearHighlights(); // Clear highlights from previous PDF
    dummyAnalysisResult = null; // Reset analysis result

    const fileReader = new FileReader();
    fileReader.onload = async function () {
        const typedarray = new Uint8Array(this.result);
        try {
            const loadingTask = pdfjsLib.getDocument({ data: typedarray });
            currentPdfDoc = await loadingTask.promise;
            statusDiv.textContent = `PDF loaded (${currentPdfDoc.numPages} pages). Rendering page 1...`;
            currentPageNum = 1;
            renderPage(currentPageNum);
        } catch (reason) {
            console.error('Error during PDF loading/rendering: ', reason);
            statusDiv.textContent = `Error loading PDF: ${reason.message}`;
        }
    };
    fileReader.readAsArrayBuffer(file);
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


// --- SIMULATED BACKEND INTERACTION ---
let dummyAnalysisResult = null; // Store result to redraw highlights on page change

async function simulateBackendAnalysis(file) {
    statusDiv.textContent = 'Analyzing document (simulation)...';

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

    statusDiv.textContent = 'Analysis complete (simulation).';
    extractedDataDiv.textContent = JSON.stringify(dummyAnalysisResult, null, 2);

    // Draw highlights based on the dummy result
    drawHighlights(dummyAnalysisResult);
}

analyzeButton.addEventListener('click', () => {
    if (!currentFile) {
        statusDiv.textContent = 'Please select a PDF file first.';
        return;
    }
    simulateBackendAnalysis(currentFile);
});

// TODO: Add basic pagination controls (optional)
// e.g., buttons for previous/next page that call queueRenderPage(newPageNum)
// and update currentPageNum. Remember to redraw highlights after page change.