// Get references to DOM elements
const fileInput = document.getElementById('fileInput');
const selectFileButton = document.getElementById('selectFileButton'); // New button
const currentFileNameSpan = document.getElementById('currentFileName'); // Span for filename
const analyzeButton = document.getElementById('analyzeButton');
const statusDiv = document.getElementById('status');
const extractedDataContainer = document.getElementById('extractedDataContainer'); // New reference
const pdfCanvas = document.getElementById('pdfCanvas');
const textLayer = document.getElementById('textLayer'); // New reference for text layer
const pdfViewerContainer = document.getElementById('pdfViewerContainer');
const ctx = pdfCanvas.getContext('2d');
const pageNumDisplay = document.getElementById('pageNumDisplay');
const totalPagesDisplay = document.getElementById('totalPagesDisplay');
const prevPageButton = document.getElementById('prevPageButton');
const nextPageButton = document.getElementById('nextPageButton');
const loadingIndicator = document.getElementById('loadingIndicator');

// --- Global Variables ---
let pdfDoc = null; // Use this single variable for the loaded PDF document
let currentFile = null; // Will hold the File or Blob object
let currentPageNum = 1; // Start with page 1
let pageRendering = false;
let pageNumPending = null;
const scale = 1.5; // Adjust scale for rendering quality/size
let currentAnalysisResult = null; // Store the actual result from the backend
let highlightAfterRender = null; // Store polygon data for highlighting after page render
let currentRenderTask = null; // Keep track of rendering task
let currentTextLayerTask = null; // Keep track of text layer rendering task

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
        if (!pdfDoc) {
            reject(new Error("No PDF document loaded."));
            return;
        }
        pageRendering = true;
        clearHighlights(); // Clear highlights before rendering new page

        // Clear text layer
        textLayer.innerHTML = '';

        // Using promise to fetch the page
        pdfDoc.getPage(pageNum).then(page => {
            const viewport = page.getViewport({ scale: scale });
            pdfCanvas.height = viewport.height;
            pdfCanvas.width = viewport.width;

            // Adjust text layer dimensions to match canvas
            textLayer.style.width = `${viewport.width}px`;
            textLayer.style.height = `${viewport.height}px`;

            // Render PDF page into canvas context
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };
            currentRenderTask = page.render(renderContext);

            // Get text content to add to text layer
            const textContentPromise = page.getTextContent();

            currentRenderTask.promise.then(() => {
                // Handle text layer rendering
                textContentPromise.then(textContent => {
                    // Create text layer
                    const textLayerDiv = textLayer;
                    textLayerDiv.innerHTML = '';

                    pdfjsLib.renderTextLayer({
                        textContent: textContent,
                        container: textLayerDiv,
                        viewport: viewport,
                        textDivs: []
                    });

                    // Finish rendering
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
                    console.error('Error rendering text layer:', err);
                    pageRendering = false;
                    currentRenderTask = null; // Clear task tracker
                    resolve(); // Still resolve as the canvas render was successful
                });
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
 * Handles file selection, loads and renders the first page of the PDF.
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
        alert('Please select a PDF file.');
        fileInput.value = '';
        return;
    }
    console.log("handleFileSelect: New file selected. Resetting state.");
    // Reset state for the new file
    pdfDoc = null; // Explicitly reset pdfDoc
    currentPageNum = 1;
    extractedDataContainer.innerHTML = '<p>Select a PDF and click "Analyze Document".</p>';
    pageNumDisplay.textContent = '-';
    totalPagesDisplay.textContent = '-';
    if (pdfCanvas && ctx) { // Ensure canvas/ctx are available before clearing
        ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
    }
    analyzeButton.disabled = true;
    prevPageButton.disabled = true;
    nextPageButton.disabled = true;
    loadingIndicator.style.display = 'block';

    const fileReader = new FileReader();
    fileReader.onload = function () {
        console.log("handleFileSelect: FileReader onload.");
        const typedarray = new Uint8Array(this.result);
        const loadingTask = pdfjsLib.getDocument(typedarray);
        loadingTask.promise.then(pdf => {
            console.log('handleFileSelect: pdfjsLib.getDocument successful.');
            pdfDoc = pdf; // Assign the loaded PDF object
            console.log('handleFileSelect: pdfDoc assigned. Value:', pdfDoc); // Log the object
            totalPagesDisplay.textContent = pdf.numPages;
            renderPage(currentPageNum).then(() => {
                console.log("handleFileSelect: First page rendered. Enabling analyze button.");
                analyzeButton.disabled = false;
                updatePageControls();
            }).catch(renderErr => {
                console.error("handleFileSelect: Error rendering first page:", renderErr);
                loadingIndicator.style.display = 'none';
            });
            loadingIndicator.style.display = 'none';
        }).catch(error => {
            console.error('handleFileSelect: Error loading PDF document:', error);
            alert(`Error loading PDF: ${error.message}`);
            pdfDoc = null; // Ensure null on error
            loadingIndicator.style.display = 'none';
            analyzeButton.disabled = true;
        });
    };
    fileReader.onerror = function () {
        console.error("FileReader error occurred.");
        alert("Error reading the selected file.");
        loadingIndicator.style.display = 'none';
        analyzeButton.disabled = true;
        pdfDoc = null;
    };
    fileReader.readAsArrayBuffer(file);
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
    pdfDoc = null; // Reset global pdfDoc before loading new one
    analyzeButton.disabled = true; // Disable analyze until PDF is ready

    const fileReader = new FileReader();
    fileReader.onload = async function () {
        const typedarray = new Uint8Array(this.result);
        try {
            const loadingTask = pdfjsLib.getDocument({ data: typedarray });
            // Assign to the global pdfDoc variable
            pdfDoc = await loadingTask.promise;
            console.log('loadAndRenderPdf: pdfDoc assigned. Value:', pdfDoc); // Log assignment
            statusDiv.textContent = `PDF loaded (${pdfDoc.numPages} pages). Rendering page 1...`;
            currentPageNum = 1;
            // Update total pages display if it exists
            if (totalPagesDisplay) totalPagesDisplay.textContent = pdfDoc.numPages;
            await renderPage(currentPageNum); // Render the first page and wait for it
            console.log("loadAndRenderPdf: First page rendered. Enabling analyze button.");
            analyzeButton.disabled = false; // Enable analyze button *after* rendering
        } catch (reason) {
            console.error('Error during PDF loading/rendering: ', reason);
            statusDiv.textContent = `Error loading PDF: ${reason.message}`;
            currentFileNameSpan.textContent = `Error loading ${fileName}`;
            pdfDoc = null; // Ensure pdfDoc is null on error
            analyzeButton.disabled = true;
        }
    };
    fileReader.onerror = () => {
        statusDiv.textContent = `Error reading file ${fileName}.`;
        currentFileNameSpan.textContent = `Error reading ${fileName}`;
        pdfDoc = null; // Ensure pdfDoc is null on error
        analyzeButton.disabled = true;
    }
    fileReader.readAsArrayBuffer(fileObject);
}

// --- Default PDF Loading ----
document.addEventListener('DOMContentLoaded', async () => {
    statusDiv.textContent = 'Fetching default PDF (input.pdf)...';
    try {
        // Fetch the local PDF file relative to index.html
        const response = await fetch('input.pdf');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const pdfBlob = await response.blob();
        loadAndRenderPdf(pdfBlob, 'input.pdf'); // Load and render the fetched blob
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
fileInput.addEventListener('change', handleFileSelect);

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
 * @param {Array} boundingRegions The bounding regions from the analysis result for a specific field.
 */
function handleLocationClick(boundingRegions) {
    console.log("--- handleLocationClick Start ---");
    console.log(`Current page number viewed: ${currentPageNum}`);

    // Most critical check: Is pdfDoc defined and non-null?
    if (typeof pdfDoc === 'undefined') {
        // This is the ReferenceError case
        console.error("Highlight Error: CRITICAL - pdfDoc variable is not defined in this scope!");
        alert("Error: PDF document reference is missing (undefined). Please try reloading the PDF.");
        return;
    }
    if (pdfDoc === null) {
        // This handles the case where it's reset or hasn't loaded yet
        console.error("Highlight Error: pdfDoc is null. PDF might be loading, failed to load, or was reset.");
        alert("Error: PDF document is not ready (null). Please wait for it to load or reload the file.");
        return;
    }
    if (!pdfCanvas || !ctx) {
        console.error("Highlight Error: Canvas or 2D context is not ready.");
        return;
    }

    // --- If we passed the checks above, pdfDoc exists and is not null ---
    console.log("Highlight Info: pdfDoc object is available:", pdfDoc);

    // Find the region matching the currently displayed page number
    const region = boundingRegions.find(r => r.page_number === currentPageNum);

    if (!region) {
        console.warn(`Highlight Warning: No bounding region found where page_number === ${currentPageNum}.`);
        const availablePages = boundingRegions.map(r => r.page_number);
        console.log(`Available page numbers in these regions: [${availablePages.join(', ')}]`);
        console.log("--- handleLocationClick End (No Region Found) ---");
        return;
    }

    console.log(`Highlight Info: Found region for page ${currentPageNum}:`, JSON.stringify(region, null, 2));

    if (!region.polygon || region.polygon.length === 0) {
        console.warn(`Highlight Warning: Region found for page ${currentPageNum}, but it has no polygon data or polygon is empty.`);
        console.log("--- handleLocationClick End (Missing Polygon) ---");
        return;
    }

    const polygon = region.polygon;
    console.log("Highlight Info: Valid polygon found:", polygon);

    if (polygon.length < 8 || polygon.length % 2 !== 0) {
        console.warn("Highlight Warning: Polygon data seems invalid (less than 4 points or odd number of coordinates):", polygon);
        console.log("--- handleLocationClick End (Invalid Polygon) ---");
        return;
    }

    console.log("Highlight Info: Proceeding to re-render page and draw highlight...");
    renderPage(currentPageNum).then(() => {
        console.log("Highlight Info: Page re-rendered. Getting page object...");
        pdfDoc.getPage(currentPageNum).then(page => {
            const scale = 1.5; // Must match the scale in renderPage
            const viewport = page.getViewport({ scale: scale });
            const pageHeightInPoints = page.view[3]; // Height of the PDF page in points

            console.log("Highlight Info: Viewport obtained. Drawing polygon...");
            console.log("Page dimensions:", page.view, "Height in points:", pageHeightInPoints);

            // Start a new path
            ctx.beginPath();

            // CRITICAL FIX: Proper coordinate conversion from inches to PDF points to canvas pixels
            // 1. Convert first point from inches (Document Intelligence) to PDF points (1 inch = 72 points)
            // 2. For Y coordinates, we need to flip the origin from top-left to bottom-left
            // 3. Then convert from points to canvas pixels using the viewport

            const INCH_TO_POINT = 72; // Standard conversion: 1 inch = 72 points in PDF

            // Convert first coordinate and move to it
            const firstPointX_point = polygon[0] * INCH_TO_POINT; // X: inch to point
            const firstPointY_point = pageHeightInPoints - (polygon[1] * INCH_TO_POINT); // Y: inch to point with origin flip

            // Convert from PDF points to canvas pixels
            const firstPoint = viewport.convertToViewportPoint(firstPointX_point, firstPointY_point);
            ctx.moveTo(firstPoint[0], firstPoint[1]);
            console.log(`Draw: MoveTo (${firstPoint[0].toFixed(2)}, ${firstPoint[1].toFixed(2)}) [converted from inches: (${polygon[0]}, ${polygon[1]})]`);

            // Do the same for each remaining point
            for (let i = 2; i < polygon.length; i += 2) {
                const pointX_point = polygon[i] * INCH_TO_POINT; // X: inch to point
                const pointY_point = pageHeightInPoints - (polygon[i + 1] * INCH_TO_POINT); // Y: inch to point with origin flip

                // Convert from PDF points to canvas pixels
                const point = viewport.convertToViewportPoint(pointX_point, pointY_point);
                ctx.lineTo(point[0], point[1]);
                console.log(`Draw: LineTo (${point[0].toFixed(2)}, ${point[1].toFixed(2)}) [converted from inches: (${polygon[i]}, ${polygon[i + 1]})]`);
            }

            ctx.closePath();

            // Style the highlight
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'; // Semi-transparent yellow fill
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)'; // Red border
            ctx.lineWidth = 2; // Make border a bit thicker for visibility

            // Apply the drawing
            ctx.fill();
            ctx.stroke();
            console.log("Highlight Info: Drawing complete.");

        }).catch(err => {
            console.error('Highlight Error: Failed to get page object after re-render:', err);
        });
    }).catch(err => {
        console.error('Highlight Error: Failed to re-render page before highlighting:', err);
    });
    console.log("--- handleLocationClick End (Highlight Attempted) ---");
}

/**
 * Displays the formatted analysis results in the UI.
 * @param {object} resultData The analysis result data from the backend.
 */
function displayFormattedResults(resultData) {
    extractedDataContainer.innerHTML = '';
    console.log("displayFormattedResults: Starting. pdfDoc status:", pdfDoc ? `Loaded (${pdfDoc.numPages} pages)` : "Not Loaded/Null");

    if (!resultData || !resultData.documents || resultData.documents.length === 0) {
        extractedDataContainer.innerHTML = 'No documents found in the analysis result.';
        return;
    }

    resultData.documents.forEach((doc, docIndex) => {
        const docDiv = document.createElement('div');
        docDiv.classList.add('document-result');
        const docConfidenceText = (typeof doc.confidence === 'number') ? doc.confidence.toFixed(3) : 'N/A';
        docDiv.innerHTML = `<h3>Document #${docIndex + 1} (Type: ${doc.doc_type || 'N/A'}, Confidence: ${docConfidenceText})</h3>`;

        const fieldsList = document.createElement('ul');
        if (doc.fields) {
            for (const fieldName in doc.fields) {
                const field = doc.fields[fieldName];
                const listItem = document.createElement('li');
                const fieldConfidenceText = (typeof field.confidence === 'number') ? field.confidence.toFixed(3) : 'N/A';
                const fieldValueText = field.content || 'N/A';

                listItem.innerHTML = `
                    <strong>${fieldName}</strong> (Confidence: ${fieldConfidenceText}):
                    <span class="field-value" title="Click to highlight (if available)" data-field-name="${fieldName}">${fieldValueText}</span>
                `;

                const valueSpan = listItem.querySelector('.field-value');
                if (field.bounding_regions && field.bounding_regions.length > 0 && field.bounding_regions[0].polygon) {
                    valueSpan.style.cursor = 'pointer';
                    valueSpan.style.textDecoration = 'underline';

                    const pdfDocStateWhenListenerCreated = pdfDoc;
                    console.log(`displayFormattedResults: Adding listener for '${fieldName}'. pdfDoc state now:`, pdfDocStateWhenListenerCreated ? "Exists" : "NULL or Undefined");

                    valueSpan.addEventListener('click', () => {
                        console.log(`Click Handler for '${fieldName}': Executing. pdfDoc state now:`, pdfDoc ? "Exists" : "NULL or Undefined");
                        if (!pdfDoc) {
                            console.error(`Click Handler for '${fieldName}': Aborting highlight because pdfDoc is currently null or undefined.`);
                            alert("Cannot highlight: The PDF document reference is missing. Please try reloading the file.");
                            return;
                        }
                        handleLocationClick(field.bounding_regions);
                    });
                } else {
                    valueSpan.title = "No location data available";
                    valueSpan.style.cursor = 'default';
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
    console.log("displayFormattedResults: Finished.");
}

/**
 * Draws a single highlight based on polygon data.
 * Clears previous highlights first.
 * @param {number[]} polygon The polygon coordinates (from Document Intelligence, in inches, top-left origin).
 * @param {number} pageNum The page number the polygon belongs to.
 */
function drawSpecificHighlight(polygon, pageNum) {
    clearHighlights(); // Clear any existing highlights
    if (!pdfDoc || pageNum !== currentPageNum) return; // Ensure correct page is loaded

    pdfDoc.getPage(pageNum).then(page => {
        const viewport = page.getViewport({ scale: scale });
        const pageHeightInPoints = page.view[3];

        if (polygon && polygon.length >= 8) {
            let minX_inch = polygon[0], maxX_inch = polygon[0];
            let minY_inch = polygon[1], maxY_inch = polygon[1];
            for (let i = 2; i < polygon.length; i += 2) {
                minX_inch = Math.min(minX_inch, polygon[i]);
                maxX_inch = Math.max(maxX_inch, polygon[i]);
                minY_inch = Math.min(minY_inch, polygon[i + 1]);
                maxY_inch = Math.max(maxY_inch, polygon[i + 1]);
            }

            const pdfPointsTopLeft = [
                minX_inch * 72,
                pageHeightInPoints - (minY_inch * 72)
            ];
            const pdfPointsBottomRight = [
                maxX_inch * 72,
                pageHeightInPoints - (maxY_inch * 72)
            ];

            const viewportTopLeft = viewport.convertToViewportPoint(pdfPointsTopLeft[0], pdfPointsTopLeft[1]);
            const viewportBottomRight = viewport.convertToViewportPoint(pdfPointsBottomRight[0], pdfPointsBottomRight[1]);

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