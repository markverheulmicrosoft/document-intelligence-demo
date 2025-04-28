// Enhanced Document Analysis Script
// This script provides functionality for the enhanced document analysis UI

// Get references to DOM elements
const fileInput = document.getElementById('fileInput');
const selectFileButton = document.getElementById('selectFileButton');
const currentFileNameSpan = document.getElementById('currentFileName');
const analyzeButton = document.getElementById('analyzeButton');
const statusDiv = document.getElementById('status');
const extractedDataContainer = document.getElementById('extractedDataContainer');
const textElementsContainer = document.getElementById('textElementsContainer');
const extractedImagesContainer = document.getElementById('extractedImagesContainer');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const searchResults = document.getElementById('searchResults');
const pdfCanvas = document.getElementById('pdfCanvas');
const textLayer = document.getElementById('textLayer');
const highlightLayer = document.getElementById('highlightLayer');
const pdfViewerContainer = document.getElementById('pdfViewerContainer');
const pageNumDisplay = document.getElementById('pageNumDisplay');
const totalPagesDisplay = document.getElementById('totalPagesDisplay');
const prevPageButton = document.getElementById('prevPageButton');
const nextPageButton = document.getElementById('nextPageButton');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// --- Global Variables ---
let pdfDoc = null;
let currentFile = null;
let currentPageNum = 1;
let pageRendering = false;
let pageNumPending = null;
const scale = 1.5;
let currentAnalysisResult = null;
let currentRenderTask = null;
let currentTextLayerTask = null;
let enhancedAnalysisData = null;

// --- Tab Functionality ---
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabId = tab.getAttribute('data-tab');

        // Remove active class from all tabs and contents
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        // Add active class to clicked tab and corresponding content
        tab.classList.add('active');
        document.getElementById(tabId).classList.add('active');
    });
});

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
            const ctx = pdfCanvas.getContext('2d');
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

                    // Update page navigation
                    updatePageControls();

                    // If we have enhanced analysis data, show highlights for current page
                    if (enhancedAnalysisData && enhancedAnalysisData.pages && enhancedAnalysisData.pages[currentPageNum]) {
                        highlightCurrentPageElements();
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

    // Reset state for the new file
    pdfDoc = null;
    currentPageNum = 1;
    extractedDataContainer.innerHTML = '<p>Select a PDF and click "Analyze Document".</p>';
    textElementsContainer.innerHTML = 'No text elements extracted yet.';
    extractedImagesContainer.innerHTML = 'No images extracted yet.';
    searchResults.innerHTML = 'Enter a search term above to find text in the document.';
    enhancedAnalysisData = null;

    pageNumDisplay.textContent = '-';
    totalPagesDisplay.textContent = '-';
    analyzeButton.disabled = true;
    prevPageButton.disabled = true;
    nextPageButton.disabled = true;

    statusDiv.textContent = 'Loading PDF...';

    loadAndRenderPdf(file, file.name);
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
    clearHighlights();
    enhancedAnalysisData = null;
    analyzeButton.disabled = true;

    const fileReader = new FileReader();
    fileReader.onload = async function () {
        const typedarray = new Uint8Array(this.result);
        try {
            const loadingTask = pdfjsLib.getDocument({ data: typedarray });
            pdfDoc = await loadingTask.promise;
            statusDiv.textContent = `PDF loaded (${pdfDoc.numPages} pages). Rendering page 1...`;
            currentPageNum = 1;
            totalPagesDisplay.textContent = pdfDoc.numPages;
            await renderPage(currentPageNum);
            analyzeButton.disabled = false;
            updatePageControls();
        } catch (reason) {
            console.error('Error during PDF loading/rendering: ', reason);
            statusDiv.textContent = `Error loading PDF: ${reason.message}`;
            currentFileNameSpan.textContent = `Error loading ${fileName}`;
            pdfDoc = null;
            analyzeButton.disabled = true;
        }
    };
    fileReader.onerror = () => {
        statusDiv.textContent = `Error reading file ${fileName}.`;
        currentFileNameSpan.textContent = `Error reading ${fileName}`;
        pdfDoc = null;
        analyzeButton.disabled = true;
    }
    fileReader.readAsArrayBuffer(fileObject);
}

/**
 * Update the page navigation controls based on current state
 */
function updatePageControls() {
    if (!pdfDoc) {
        prevPageButton.disabled = true;
        nextPageButton.disabled = true;
        pageNumDisplay.textContent = '-';
        totalPagesDisplay.textContent = '-';
        return;
    }

    pageNumDisplay.textContent = currentPageNum;
    totalPagesDisplay.textContent = pdfDoc.numPages;
    prevPageButton.disabled = currentPageNum <= 1;
    nextPageButton.disabled = currentPageNum >= pdfDoc.numPages;
}

/**
 * Clears any existing highlight divs.
 */
function clearHighlights() {
    const existingHighlights = highlightLayer.querySelectorAll('.highlight');
    existingHighlights.forEach(h => h.remove());
}

/**
 * Draw highlights for all text elements on the current page
 */
function highlightCurrentPageElements() {
    if (!enhancedAnalysisData || !enhancedAnalysisData.pages || !enhancedAnalysisData.pages[currentPageNum]) {
        return;
    }

    const pageData = enhancedAnalysisData.pages[currentPageNum];

    // Get all text elements (lines and words) for the current page
    const textElements = [...pageData.lines, ...pageData.words];

    // Draw bounding boxes for all elements
    textElements.forEach(element => {
        if (element.polygon && element.polygon.length >= 8) {
            drawHighlightForPolygon(element.polygon, 'rgba(0, 0, 255, 0.1)', 'rgba(0, 0, 255, 0.5)');
        }
    });

    // Draw bounding boxes for images on the current page
    if (pageData.images && pageData.images.length > 0) {
        pageData.images.forEach(image => {
            if (image.bounding_box && image.bounding_box.length >= 8) {
                drawHighlightForPolygon(image.bounding_box, 'rgba(0, 128, 0, 0.1)', 'rgba(0, 128, 0, 0.5)');
            }
        });
    }
}

/**
 * Highlight a specific text element by its polygon coordinates
 * @param {Array} polygon Array of coordinates for the polygon
 * @param {string} fillColor CSS color for the highlight fill
 * @param {string} borderColor CSS color for the highlight border
 */
function drawHighlightForPolygon(polygon, fillColor = 'rgba(255, 255, 0, 0.3)', borderColor = 'rgba(255, 0, 0, 0.7)') {
    if (!pdfDoc || !polygon || polygon.length < 8) return;

    pdfDoc.getPage(currentPageNum).then(page => {
        const viewport = page.getViewport({ scale });
        const pageHeightInPoints = page.view[3];

        // Convert polygon coordinates (in inches) to PDF viewport coordinates
        const INCH_TO_POINT = 72; // 1 inch = 72 points in PDF

        // Find bounding rectangle of the polygon
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (let i = 0; i < polygon.length; i += 2) {
            const x_inch = polygon[i];
            const y_inch = polygon[i + 1];

            // Convert from inches to points
            const x_point = x_inch * INCH_TO_POINT;
            const y_point = pageHeightInPoints - (y_inch * INCH_TO_POINT); // Flip Y coordinate

            // Convert from PDF points to canvas pixels
            const viewport_point = viewport.convertToViewportPoint(x_point, y_point);
            const x_viewport = viewport_point[0];
            const y_viewport = viewport_point[1];

            // Update min/max
            minX = Math.min(minX, x_viewport);
            minY = Math.min(minY, y_viewport);
            maxX = Math.max(maxX, x_viewport);
            maxY = Math.max(maxY, y_viewport);
        }

        // Create highlight element
        const highlight = document.createElement('div');
        highlight.className = 'highlight';
        highlight.style.left = `${minX}px`;
        highlight.style.top = `${minY}px`;
        highlight.style.width = `${maxX - minX}px`;
        highlight.style.height = `${maxY - minY}px`;
        highlight.style.backgroundColor = fillColor;
        highlight.style.borderColor = borderColor;

        highlightLayer.appendChild(highlight);
    });
}

/**
 * Displays the enhanced document analysis results in the UI.
 * @param {object} analysisData The enhanced document analysis data
 */
function displayEnhancedAnalysisResults(analysisData) {
    // Store the analysis data globally
    enhancedAnalysisData = analysisData;

    // 1. Display text elements by page
    displayTextElements(analysisData);

    // 2. Display extracted images
    displayExtractedImages(analysisData);

    // 3. Display document analysis summary
    displayAnalysisSummary(analysisData);

    // 4. Highlight elements on current page
    highlightCurrentPageElements();
}

/**
 * Display text elements from analysis in the text elements tab
 */
function displayTextElements(analysisData) {
    if (!analysisData || !analysisData.pages) {
        textElementsContainer.innerHTML = 'No text elements found in the document.';
        return;
    }

    let html = '<div class="page-selector">Jump to page: ';
    const pageNumbers = Object.keys(analysisData.pages).sort((a, b) => Number(a) - Number(b));

    pageNumbers.forEach(pageNum => {
        html += `<button class="page-button" data-page="${pageNum}">Page ${pageNum}</button> `;
    });
    html += '</div>';

    pageNumbers.forEach(pageNum => {
        const pageData = analysisData.pages[pageNum];
        html += `<h4>Page ${pageNum}</h4>`;

        if (pageData.lines && pageData.lines.length > 0) {
            html += '<h5>Lines</h5>';
            html += '<div class="text-elements-list">';
            pageData.lines.forEach((line, index) => {
                html += `<div class="text-element" data-page="${pageNum}" data-type="line" data-index="${index}">
                    ${line.text}
                </div>`;
            });
            html += '</div>';
        }

        if (pageData.words && pageData.words.length > 0) {
            html += '<h5>Words</h5>';
            html += '<div class="text-elements-list">';
            pageData.words.forEach((word, index) => {
                html += `<div class="text-element" data-page="${pageNum}" data-type="word" data-index="${index}">
                    ${word.text}
                </div>`;
            });
            html += '</div>';
        }
    });

    textElementsContainer.innerHTML = html;

    // Add event listeners to page buttons
    const pageButtons = textElementsContainer.querySelectorAll('.page-button');
    pageButtons.forEach(button => {
        button.addEventListener('click', () => {
            const pageNum = parseInt(button.getAttribute('data-page'));
            if (pageNum && pageNum !== currentPageNum) {
                queueRenderPage(pageNum);
            }
        });
    });

    // Add event listeners to text elements
    const textElements = textElementsContainer.querySelectorAll('.text-element');
    textElements.forEach(element => {
        element.addEventListener('click', () => {
            const pageNum = parseInt(element.getAttribute('data-page'));
            const type = element.getAttribute('data-type');
            const index = parseInt(element.getAttribute('data-index'));

            // Navigate to the page if needed
            if (pageNum !== currentPageNum) {
                queueRenderPage(pageNum);
                // We'll highlight after page is rendered in the renderPage function
            } else {
                // Highlight the element on the current page
                const pageData = analysisData.pages[pageNum];
                let polygon;

                if (type === 'line' && pageData.lines && pageData.lines[index]) {
                    polygon = pageData.lines[index].polygon;
                } else if (type === 'word' && pageData.words && pageData.words[index]) {
                    polygon = pageData.words[index].polygon;
                }

                if (polygon) {
                    clearHighlights();
                    drawHighlightForPolygon(polygon);
                }
            }
        });
    });
}

/**
 * Display extracted images in the images tab
 */
function displayExtractedImages(analysisData) {
    if (!analysisData || !analysisData.extracted_images || analysisData.extracted_images.length === 0) {
        extractedImagesContainer.innerHTML = 'No images found in the document.';
        return;
    }

    let html = '';
    analysisData.extracted_images.forEach((image, index) => {
        html += `
        <div class="extracted-image" data-page="${image.page_number}" data-index="${index}">
            <div class="image-header">
                <strong>Image ${index + 1}</strong> (Page ${image.page_number})
                <button class="view-image-btn" data-page="${image.page_number}">View on Page</button>
            </div>
            <div class="image-description">${image.description || 'No description available'}</div>
        </div>`;
    });

    extractedImagesContainer.innerHTML = html;

    // Add event listeners to view image buttons
    const viewButtons = extractedImagesContainer.querySelectorAll('.view-image-btn');
    viewButtons.forEach(button => {
        button.addEventListener('click', () => {
            const pageNum = parseInt(button.getAttribute('data-page'));
            if (pageNum && pageNum !== currentPageNum) {
                queueRenderPage(pageNum);
            }

            // Find and highlight the image on the page
            if (analysisData.pages[pageNum]) {
                const pageData = analysisData.pages[pageNum];
                if (pageData.images && pageData.images.length > 0) {
                    clearHighlights();

                    // Find image with matching index in the page
                    const imageIndex = parseInt(button.parentElement.parentElement.getAttribute('data-index'));
                    const matchingImage = pageData.images.find(img => img.image_index === imageIndex);

                    if (matchingImage && matchingImage.bounding_box) {
                        drawHighlightForPolygon(matchingImage.bounding_box, 'rgba(0, 128, 0, 0.2)', 'rgba(0, 128, 0, 0.8)');
                    }
                }
            }
        });
    });
}

/**
 * Display analysis summary in the extracted data tab
 */
function displayAnalysisSummary(analysisData) {
    if (!analysisData || !analysisData.pages) {
        extractedDataContainer.innerHTML = 'No analysis data available.';
        return;
    }

    let totalLines = 0;
    let totalWords = 0;
    let totalImages = 0;

    // Count elements across all pages
    Object.values(analysisData.pages).forEach(page => {
        if (page.lines) totalLines += page.lines.length;
        if (page.words) totalWords += page.words.length;
        if (page.images) totalImages += page.images.length;
    });

    let html = `
    <div class="analysis-summary">
        <h4>Document Summary</h4>
        <ul>
            <li><strong>Pages:</strong> ${Object.keys(analysisData.pages).length}</li>
            <li><strong>Text Lines:</strong> ${totalLines}</li>
            <li><strong>Words:</strong> ${totalWords}</li>
            <li><strong>Images:</strong> ${totalImages}</li>
        </ul>
    </div>
    
    <div class="page-content-summary">
        <h4>Content by Page</h4>`;

    Object.keys(analysisData.pages).sort((a, b) => Number(a) - Number(b)).forEach(pageNum => {
        const page = analysisData.pages[pageNum];
        html += `
        <div class="page-summary">
            <h5 class="page-title" data-page="${pageNum}">Page ${pageNum}</h5>
            <ul>
                <li>${page.lines ? page.lines.length : 0} lines</li>
                <li>${page.words ? page.words.length : 0} words</li>
                <li>${page.images ? page.images.length : 0} images</li>
            </ul>
        </div>`;
    });

    html += '</div>';

    extractedDataContainer.innerHTML = html;

    // Add event listeners to page titles
    const pageTitles = extractedDataContainer.querySelectorAll('.page-title');
    pageTitles.forEach(title => {
        title.style.cursor = 'pointer';
        title.style.textDecoration = 'underline';
        title.addEventListener('click', () => {
            const pageNum = parseInt(title.getAttribute('data-page'));
            if (pageNum && pageNum !== currentPageNum) {
                queueRenderPage(pageNum);
            }
        });
    });
}

/**
 * Search for text in the document
 */
function searchDocument() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    if (!searchTerm || !enhancedAnalysisData) {
        searchResults.innerHTML = 'Please enter a search term and analyze a document first.';
        return;
    }

    let results = [];

    // Search in all pages
    Object.entries(enhancedAnalysisData.pages).forEach(([pageNum, pageData]) => {
        // Search in lines
        if (pageData.lines) {
            pageData.lines.forEach((line, lineIndex) => {
                if (line.text.toLowerCase().includes(searchTerm)) {
                    results.push({
                        page: parseInt(pageNum),
                        text: line.text,
                        type: 'line',
                        index: lineIndex,
                        polygon: line.polygon
                    });
                }
            });
        }

        // Search in words
        if (pageData.words) {
            pageData.words.forEach((word, wordIndex) => {
                if (word.text.toLowerCase().includes(searchTerm)) {
                    results.push({
                        page: parseInt(pageNum),
                        text: word.text,
                        type: 'word',
                        index: wordIndex,
                        polygon: word.polygon
                    });
                }
            });
        }
    });

    // Display search results
    if (results.length === 0) {
        searchResults.innerHTML = `No results found for "${searchTerm}".`;
        return;
    }

    let html = `<h4>Search Results (${results.length})</h4>`;
    results.forEach((result, index) => {
        html += `
        <div class="search-result" data-page="${result.page}" data-type="${result.type}" data-index="${result.index}">
            <div><strong>Page ${result.page}:</strong> ${result.text}</div>
            <button class="view-result-btn">View on Page</button>
        </div>`;
    });

    searchResults.innerHTML = html;

    // Add event listeners to view result buttons
    const viewButtons = searchResults.querySelectorAll('.view-result-btn');
    viewButtons.forEach(button => {
        button.addEventListener('click', () => {
            const resultElement = button.parentElement;
            const pageNum = parseInt(resultElement.getAttribute('data-page'));
            const type = resultElement.getAttribute('data-type');
            const index = parseInt(resultElement.getAttribute('data-index'));

            // Navigate to the page
            if (pageNum !== currentPageNum) {
                queueRenderPage(pageNum);
                // Store the element to highlight after page render
                sessionStorage.setItem('highlightAfterRender', JSON.stringify({
                    page: pageNum,
                    type: type,
                    index: index
                }));
            } else {
                // Highlight the element on the current page
                highlightSearchResult(pageNum, type, index);
            }
        });
    });
}

/**
 * Highlight a search result by type and index
 */
function highlightSearchResult(pageNum, type, index) {
    if (!enhancedAnalysisData || !enhancedAnalysisData.pages[pageNum]) return;

    const pageData = enhancedAnalysisData.pages[pageNum];
    let polygon;

    if (type === 'line' && pageData.lines && pageData.lines[index]) {
        polygon = pageData.lines[index].polygon;
    } else if (type === 'word' && pageData.words && pageData.words[index]) {
        polygon = pageData.words[index].polygon;
    }

    if (polygon) {
        clearHighlights();
        drawHighlightForPolygon(polygon, 'rgba(255, 255, 0, 0.3)', 'rgba(255, 0, 0, 0.7)');
    }
}

// --- Event Listeners ---

// Check for stored highlight after render
renderPage = (function (originalRenderPage) {
    return async function (pageNum) {
        await originalRenderPage(pageNum);

        // Check if we need to highlight something after rendering
        const storedHighlight = sessionStorage.getItem('highlightAfterRender');
        if (storedHighlight) {
            const highlight = JSON.parse(storedHighlight);
            if (highlight.page === pageNum) {
                highlightSearchResult(highlight.page, highlight.type, highlight.index);
                sessionStorage.removeItem('highlightAfterRender');
            }
        }
    };
})(renderPage);

// Trigger hidden file input when "Change PDF" button is clicked
selectFileButton.addEventListener('click', () => {
    fileInput.click();
});

// Handle file selection via the input element
fileInput.addEventListener('change', handleFileSelect);

// Analyze button - Calls the enhanced document analysis API
analyzeButton.addEventListener('click', async () => {
    if (!currentFile) {
        statusDiv.textContent = 'Please select or load a PDF file first.';
        return;
    }

    statusDiv.textContent = 'Analyzing document...';
    extractedDataContainer.innerHTML = 'Analyzing...';
    textElementsContainer.innerHTML = 'Analyzing...';
    extractedImagesContainer.innerHTML = 'Analyzing...';
    clearHighlights();
    enhancedAnalysisData = null;

    const formData = new FormData();
    formData.append('file', currentFile, currentFile.name || 'document.pdf');

    try {
        // Call the FastAPI enhanced document analysis endpoint
        const response = await fetch('/enhanced-document-analysis', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const resultData = await response.json();
        statusDiv.textContent = 'Analysis complete. Document content extracted and images analyzed.';

        // Display the enhanced analysis results
        displayEnhancedAnalysisResults(resultData);

        // Switch to the extracted data tab to show results
        const extractedDataTab = document.querySelector('.tab[data-tab="extractedData"]');
        extractedDataTab.click();

    } catch (error) {
        console.error('Error calling analysis API:', error);
        statusDiv.textContent = `Analysis failed: ${error.message}`;
        extractedDataContainer.innerHTML = `Error during analysis: ${error.message}`;
        textElementsContainer.innerHTML = `Error during analysis: ${error.message}`;
        extractedImagesContainer.innerHTML = `Error during analysis: ${error.message}`;
        enhancedAnalysisData = null;
    }
});

// Previous/Next page buttons
prevPageButton.addEventListener('click', () => {
    if (currentPageNum <= 1) return;
    queueRenderPage(currentPageNum - 1);
});

nextPageButton.addEventListener('click', () => {
    if (!pdfDoc || currentPageNum >= pdfDoc.numPages) return;
    queueRenderPage(currentPageNum + 1);
});

// Search button
searchButton.addEventListener('click', searchDocument);

// Allow searching with Enter key
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchDocument();
    }
});

// --- Default PDF Loading on startup ---
document.addEventListener('DOMContentLoaded', async () => {
    statusDiv.textContent = 'Fetching default PDF...';
    try {
        // Fetch the local PDF file from the static directory
        const response = await fetch('/static/input.pdf');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const pdfBlob = await response.blob();
        loadAndRenderPdf(pdfBlob, 'input.pdf');
    } catch (error) {
        console.error('Error fetching default PDF:', error);
        statusDiv.textContent = 'Error loading default PDF. Please select one manually.';
        currentFileNameSpan.textContent = 'No file loaded.';
    }
});