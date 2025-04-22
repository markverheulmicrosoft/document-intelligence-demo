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
let highlightAfterRender = null; // Store polygon data for highlighting after page render

/**
 * Get page info from document, resize canvas accordingly, and render page.
 * @param {number} pageNum Page number.
 */
async function renderPage(pageNum) {
    if (!currentPdfDoc) return;
    pageRendering = true;
    clearHighlights(); // Clear highlights before rendering new page

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

    // Update status or UI if needed
    statusDiv.textContent = `Page ${pageNum} rendered.`;

    // If a specific highlight was requested before rendering, draw it now
    if (highlightAfterRender && highlightAfterRender.pageNum === pageNum) {
        drawSpecificHighlight(highlightAfterRender.polygon, pageNum);
        highlightAfterRender = null; // Clear the request
    }

    // Handle pending page render requests
    if (pageNumPending !== null) {
        const pendingPage = pageNumPending;
        pageNumPending = null;
        renderPage(pendingPage); // Render the pending page
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
    highlightAfterRender = null; // Clear pending highlight request

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
 * Draws highlights for ALL fields on the current page from the analysis result.
 * (Used less frequently now, primarily for initial draw if desired)
 * @param {object} analysisResult - The result object containing fields and bounding boxes.
 */
function drawHighlights(analysisResult) {
    clearHighlights();
    if (!analysisResult || !currentPdfDoc) return;

    currentPdfDoc.getPage(currentPageNum).then(page => {
        const viewport = page.getViewport({ scale: scale });

        if (analysisResult.documents && Array.isArray(analysisResult.documents)) {
            analysisResult.documents.forEach(doc => {
                if (doc.fields) {
                    Object.values(doc.fields).forEach(field => {
                        if (field.boundingRegions) {
                            field.boundingRegions.forEach(region => {
                                if (region.pageNumber === currentPageNum) {
                                    const polygon = region.polygon;
                                    if (polygon && polygon.length >= 8) {
                                        // Draw the highlight (code duplicated in drawSpecificHighlight)
                                        let minX = polygon[0], maxX = polygon[0];
                                        let minY = polygon[1], maxY = polygon[1];
                                        for (let i = 2; i < polygon.length; i += 2) {
                                            minX = Math.min(minX, polygon[i]);
                                            maxX = Math.max(maxX, polygon[i]);
                                            minY = Math.min(minY, polygon[i+1]);
                                            maxY = Math.max(maxY, polygon[i+1]);
                                        }
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
        // Add similar logic for key_value_pairs if needed
    }).catch(error => {
        console.error("Error getting page for drawing all highlights:", error);
    });
}

/**
 * Formats and displays the analysis results in a more readable way.
 * @param {object} analysisResult - The result object from Document Intelligence.
 */
function displayFormattedResults(analysisResult) {
    extractedDataContainer.innerHTML = ''; // Clear previous results

    if (!analysisResult) {
        extractedDataContainer.textContent = 'No analysis data available.';
        return;
    }

    // Display Documents (from prebuilt/custom models)
    if (analysisResult.documents && Array.isArray(analysisResult.documents)) {
        analysisResult.documents.forEach((doc, docIndex) => {
            const docDiv = document.createElement('div');
            docDiv.className = 'result-document';
            docDiv.innerHTML = `<h3>Document ${docIndex + 1} (Type: ${doc.docType || 'N/A'}, Confidence: ${doc.confidence !== undefined ? doc.confidence.toFixed(2) : 'N/A'})</h3>`;

            if (doc.fields) {
                Object.entries(doc.fields).forEach(([name, field]) => {
                    const fieldDiv = document.createElement('div');
                    fieldDiv.className = 'result-field';

                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'field-name';
                    nameSpan.textContent = `${name}: `;
                    fieldDiv.appendChild(nameSpan);

                    const valueSpan = document.createElement('span');
                    valueSpan.className = 'field-value';
                    valueSpan.textContent = field.content || 'N/A';
                    fieldDiv.appendChild(valueSpan);

                    const confidenceSpan = document.createElement('span');
                    confidenceSpan.className = 'field-confidence';
                    confidenceSpan.textContent = ` (Confidence: ${field.confidence !== undefined ? field.confidence.toFixed(2) : 'N/A'})`;
                    fieldDiv.appendChild(confidenceSpan);

                    // Add clickable location span
                    if (field.boundingRegions && field.boundingRegions.length > 0) {
                        const region = field.boundingRegions[0]; // Use first region for simplicity
                        const locationSpan = document.createElement('span');
                        locationSpan.className = 'field-location';
                        locationSpan.textContent = ` [Location: Page ${region.pageNumber}]`;
                        locationSpan.title = `Click to highlight on page ${region.pageNumber}`;
                        locationSpan.dataset.pageNumber = region.pageNumber;
                        // Store polygon data directly for highlighting function
                        locationSpan.dataset.polygon = JSON.stringify(region.polygon);

                        locationSpan.addEventListener('click', handleLocationClick);
                        fieldDiv.appendChild(locationSpan);
                    }

                    docDiv.appendChild(fieldDiv);
                });
            }
            extractedDataContainer.appendChild(docDiv);
        });
    }

    // Display Key-Value Pairs (from layout model) - Add similar loop if needed
    // ... (code for key_value_pairs can be added here if required) ...


    if (extractedDataContainer.innerHTML === '') {
        extractedDataContainer.textContent = 'No specific documents or key-value pairs found in the result.';
    }
}

/**
 * Handles clicking on a location span to trigger highlighting.
 * @param {Event} event The click event.
 */
function handleLocationClick(event) {
    const target = event.target;
    const pageNum = parseInt(target.dataset.pageNumber, 10);
    const polygon = JSON.parse(target.dataset.polygon);

    if (!isNaN(pageNum) && polygon) {
        // If the page is not currently rendered, render it first
        if (pageNum !== currentPageNum) {
            currentPageNum = pageNum;
            // Store the polygon to highlight after rendering finishes
            highlightAfterRender = { pageNum: pageNum, polygon: polygon };
            queueRenderPage(pageNum);
        } else {
            // Page is already rendered, just draw the specific highlight
            drawSpecificHighlight(polygon, pageNum);
        }
    }
}

/**
 * Draws a single highlight based on polygon data.
 * Clears previous highlights first.
 * @param {number[]} polygon The polygon coordinates (from Document Intelligence, in inches, top-left origin).
 * @param {number} pageNum The page number the polygon belongs to.
 */
function drawSpecificHighlight(polygon, pageNum) {
    clearHighlights(); // Clear any existing highlights
    if (!currentPdfDoc || pageNum !== currentPageNum) return; // Ensure correct page is loaded

    currentPdfDoc.getPage(pageNum).then(page => {
        const viewport = page.getViewport({ scale: scale });
        // Get page dimensions in PDF points (usually 1/72 inch). Origin is bottom-left.
        // page.view = [x0, y0, x1, y1] in points. Height is view[3] - view[1]. Often view[1] is 0.
        const pageHeightInPoints = page.view[3]; 

        if (polygon && polygon.length >= 8) {
            // 1. Find min/max coordinates from the polygon (these are in INCHES, top-left origin)
            let minX_inch = polygon[0], maxX_inch = polygon[0];
            let minY_inch = polygon[1], maxY_inch = polygon[1];
            for (let i = 2; i < polygon.length; i += 2) {
                minX_inch = Math.min(minX_inch, polygon[i]);
                maxX_inch = Math.max(maxX_inch, polygon[i]);
                minY_inch = Math.min(minY_inch, polygon[i+1]);
                maxY_inch = Math.max(maxY_inch, polygon[i+1]);
            }

            // 2. Convert the bounding box from inches (top-left origin) to PDF points (bottom-left origin)
            const pdfPointsTopLeft = [
                minX_inch * 72, // x in points
                pageHeightInPoints - (minY_inch * 72) // y in points (inverted)
            ];
            const pdfPointsBottomRight = [
                maxX_inch * 72, // x in points
                pageHeightInPoints - (maxY_inch * 72) // y in points (inverted)
            ];

            // 3. Convert PDF points (bottom-left origin) to Viewport coordinates (pixels, top-left origin)
            const viewportTopLeft = viewport.convertToViewportPoint(pdfPointsTopLeft[0], pdfPointsTopLeft[1]);
            const viewportBottomRight = viewport.convertToViewportPoint(pdfPointsBottomRight[0], pdfPointsBottomRight[1]);

            // 4. Create and position the highlight div
            const highlight = document.createElement('div');
            highlight.className = 'highlight';
            highlight.style.left = `${viewportTopLeft[0]}px`;
            highlight.style.top = `${viewportTopLeft[1]}px`;
            highlight.style.width = `${viewportBottomRight[0] - viewportTopLeft[0]}px`;
            highlight.style.height = `${viewportBottomRight[1] - viewportTopLeft[1]}px`;
            pdfViewerContainer.appendChild(highlight);
        }
    }).catch(error => {
        console.error("Error getting page for specific highlighting:", error);
    });
}

// --- SIMULATED BACKEND INTERACTION ---

async function simulateBackendAnalysis(file) {
    statusDiv.textContent = 'Analyzing document (simulation)...';
    extractedDataContainer.innerHTML = 'Analyzing...'; // Show analyzing state
    clearHighlights(); // Clear highlights during analysis
    highlightAfterRender = null; // Clear pending highlight request

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
                    // Add more dummy fields corresponding to your needs
                }
            }
        ]
        // Include key_value_pairs if using layout model
        // key_value_pairs: [ { key: {...}, value: { content: "...", boundingRegions: [...] } } ]
    };
    // --- End Dummy Data ---

    statusDiv.textContent = 'Analysis complete (simulation). Click location to highlight.';
    displayFormattedResults(dummyAnalysisResult); // Display the formatted results

    // No automatic highlighting after analysis - user must click
}

// TODO: Add basic pagination controls (optional)
// e.g., buttons for previous/next page that call queueRenderPage(newPageNum)
// and update currentPageNum. Remember to redraw highlights after page change.