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
let currentAnalysisResult = null; // Store the actual result from the backend
let highlightAfterRender = null; // Store polygon data for highlighting after page render
let currentRenderTask = null; // Keep track of rendering task

/**
 * Get page info from document, resize canvas accordingly, and render page.
 * @param {number} pageNum Page number.
 * @returns {Promise} A promise that resolves when rendering is complete.
 */
async function renderPage(pageNum) {
    // Cancel previous render task if any
    if (currentRenderTask) {
        currentRenderTask.cancel();
    }

    return new Promise((resolve, reject) => {
        if (!currentPdfDoc) {
            reject(new Error("No PDF document loaded."));
            return;
        }
        pageRendering = true;
        clearHighlights(); // Clear highlights before rendering new page

        // Using promise to fetch the page
        currentPdfDoc.getPage(pageNum).then(page => {
            const viewport = page.getViewport({ scale: scale });
            pdfCanvas.height = viewport.height;
            pdfCanvas.width = viewport.width;

            // Render PDF page into canvas context
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };
            currentRenderTask = page.render(renderContext);

            currentRenderTask.promise.then(() => {
                pageRendering = false;
                statusDiv.textContent = `Page ${pageNum} rendered.`;
                currentPageNum = pageNum; // Update current page number
                currentRenderTask = null; // Clear task tracker

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
                resolve(); // Resolve the promise on success
            }).catch(err => {
                console.error('Error rendering page:', err);
                pageRendering = false;
                currentRenderTask = null; // Clear task tracker
                reject(err); // Reject the promise on error
            });
        }).catch(err => {
            console.error('Error getting page:', err);
            reject(err); // Reject the promise on error
        });
    });
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
    currentAnalysisResult = null; // Reset actual analysis result
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

// Analyze button - Calls the backend API
analyzeButton.addEventListener('click', async () => {
    if (!currentFile) {
        statusDiv.textContent = 'Please select or load a PDF file first.';
        return;
    }

    statusDiv.textContent = 'Analyzing document (calling backend)...';
    extractedDataContainer.innerHTML = 'Analyzing...';
    clearHighlights();
    currentAnalysisResult = null; // Clear previous results
    highlightAfterRender = null;

    const formData = new FormData();
    formData.append('document', currentFile, currentFile.name || 'uploaded_document.pdf');

    try {
        // Call the Flask backend endpoint
        const response = await fetch('http://localhost:5000/analyze', {
            method: 'POST',
            body: formData,
        });

        const resultData = await response.json();

        if (!response.ok) {
            // Handle errors returned from the backend
            throw new Error(resultData.error || `HTTP error! status: ${response.status}`);
        }

        currentAnalysisResult = resultData; // Store the actual result
        statusDiv.textContent = 'Analysis complete. Click location to highlight.';
        displayFormattedResults(currentAnalysisResult);

    } catch (error) {
        console.error('Error calling analysis backend:', error);
        statusDiv.textContent = `Analysis failed: ${error.message}`;
        extractedDataContainer.innerHTML = `Error during analysis: ${error.message}`;
        currentAnalysisResult = null; // Ensure no partial results are stored
    }
});

/**
 * Clears any existing highlight divs.
 */
function clearHighlights() {
    const existingHighlights = pdfViewerContainer.querySelectorAll('.highlight');
    existingHighlights.forEach(h => h.remove());
}

/**
 * Handles clicks on field values to highlight the location on the PDF canvas.
 * @param {Array} boundingRegions The bounding regions from the analysis result.
 */
function handleLocationClick(boundingRegions) {
    if (!currentPdfDoc || !boundingRegions || boundingRegions.length === 0) {
        console.warn("Cannot highlight: PDF not loaded or no bounding regions.");
        return;
    }

    // Assuming the first region corresponds to the current view,
    // or find the region matching currentPageNum if multiple pages are possible.
    const region = boundingRegions.find(r => r.pageNumber === currentPageNum);

    if (!region || !region.polygon || region.polygon.length === 0) {
        console.warn("No bounding region found for the current page or region has no polygon.");
        return;
    }

    // Re-render the current page first to clear previous highlights
    renderPage(currentPageNum).then(() => {
        // Get the current page object again after re-rendering
        currentPdfDoc.getPage(currentPageNum).then(page => {
            const viewport = page.getViewport({ scale: scale }); // Use the same scale as renderPage
            const polygon = region.polygon; // Array of numbers [x1, y1, x2, y2, ...]

            if (polygon.length < 8) { // Need at least 4 points (8 numbers) for a box
                console.warn("Polygon data is insufficient to draw a box:", polygon);
                return;
            }

            console.log(`Highlighting on page ${currentPageNum}, Polygon:`, polygon); // Debug log

            // --- Drawing the Highlight Box ---
            ctx.beginPath();
            ctx.moveTo(polygon[0] * viewport.scale, polygon[1] * viewport.scale);
            for (let i = 2; i < polygon.length; i += 2) {
                ctx.lineTo(polygon[i] * viewport.scale, polygon[i + 1] * viewport.scale);
            }
            ctx.closePath();

            // Style the highlight box
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'; // Semi-transparent yellow
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)'; // Red border
            ctx.lineWidth = 1;

            ctx.fill();
            ctx.stroke();
            // --- End Drawing ---

        }).catch(err => {
            console.error('Error getting page for highlighting:', err);
        });
    }).catch(err => {
        console.error('Error re-rendering page before highlighting:', err);
    });
}

/**
 * Displays the formatted analysis results in the UI.
 * @param {object} resultData The analysis result data from the backend.
 */
function displayFormattedResults(resultData) {
    extractedDataContainer.innerHTML = ''; // Clear previous results

    if (!resultData || !resultData.documents || resultData.documents.length === 0) {
        extractedDataContainer.innerHTML = 'No documents found in the analysis result.';
        return;
    }

    resultData.documents.forEach((doc, docIndex) => {
        const docDiv = document.createElement('div');
        docDiv.classList.add('document-result');
        // Check if confidence exists and is a number before formatting
        const docConfidenceText = (typeof doc.confidence === 'number') ? doc.confidence.toFixed(3) : 'N/A';
        docDiv.innerHTML = `<h3>Document #${docIndex + 1} (Type: ${doc.doc_type || 'N/A'}, Confidence: ${docConfidenceText})</h3>`;

        const fieldsList = document.createElement('ul');
        if (doc.fields) { // Also check if fields object exists
            for (const fieldName in doc.fields) {
                const field = doc.fields[fieldName];
                const listItem = document.createElement('li');
                // Check if confidence exists and is a number before formatting
                const fieldConfidenceText = (typeof field.confidence === 'number') ? field.confidence.toFixed(3) : 'N/A';
                const fieldValueText = field.content || 'N/A'; // Use N/A if content is empty/null

                listItem.innerHTML = `
                    <strong>${fieldName}</strong> (Confidence: ${fieldConfidenceText}):
                    <span class="field-value" title="Click to highlight (if available)" data-field-name="${fieldName}">${fieldValueText}</span>
                `;

                // Add click listener for highlighting
                const valueSpan = listItem.querySelector('.field-value');
                if (field.bounding_regions && field.bounding_regions.length > 0 && field.bounding_regions[0].polygon) {
                    valueSpan.style.cursor = 'pointer';
                    valueSpan.style.textDecoration = 'underline';
                    // Pass the specific field for context if needed later, or just regions
                    valueSpan.addEventListener('click', () => handleLocationClick(field.bounding_regions));
                } else {
                    valueSpan.title = "No location data available";
                    valueSpan.style.cursor = 'default'; // Indicate non-clickable
                }

                fieldsList.appendChild(listItem);
            }
        } else {
            const noFieldsItem = document.createElement('li');
            noFieldsItem.textContent = 'No fields extracted for this document.';
            fieldsList.appendChild(noFieldsItem);
        }
        docDiv.appendChild(fieldsList);
        extractedDataContainer.appendChild(docDiv);
    });
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
                minY_inch = Math.min(minY_inch, polygon[i + 1]);
                maxY_inch = Math.max(maxY_inch, polygon[i + 1]);
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

// TODO: Add basic pagination controls (optional)
// e.g., buttons for previous/next page that call queueRenderPage(newPageNum)
// and update currentPageNum. Remember to redraw highlights after page change.