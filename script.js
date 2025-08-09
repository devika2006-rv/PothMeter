// DOM elements
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const imageUpload = document.getElementById('imageUpload');
const drawReferenceBtn = document.getElementById('drawReferenceBtn');
const clearReferenceBtn = document.getElementById('clearReferenceBtn');
const measureBtn = document.getElementById('measureBtn');
const clearMeasurementBtn = document.getElementById('clearMeasurementBtn');
const completePolygonBtn = document.getElementById('completePolygonBtn');
const knownLengthInput = document.getElementById('knownLength');
const unitSelector = document.getElementById('unit');
const cameraTab = document.getElementById('cameraTab');
const uploadTab = document.getElementById('uploadTab');
const cameraSource = document.getElementById('cameraSource');
const uploadSource = document.getElementById('uploadSource');
const videoContainer = document.getElementById('videoContainer');
const cameraFeed = document.getElementById('cameraFeed');
const startCameraBtn = document.getElementById('startCamera');
const captureBtn = document.getElementById('capturePhoto');
const flipCameraBtn = document.getElementById('flipCamera');
const lengthOption = document.getElementById('lengthOption');
const areaOption = document.getElementById('areaOption');
const volumeOption = document.getElementById('volumeOption');
const lengthResult = document.getElementById('lengthResult');
const areaResult = document.getElementById('areaResult');
const volumeResult = document.getElementById('volumeResult');
const lengthValue = document.getElementById('lengthValue');
const areaValue = document.getElementById('areaValue');
const volumeValue = document.getElementById('volumeValue');
const measurementInstructions = document.getElementById('measurementInstructions');
const volumeControls = document.getElementById('volumeControls');
const waterDepthInput = document.getElementById('waterDepth');
const potholeShapeSelect = document.getElementById('potholeShape');

// State variables
let image = null;
let scale = 0;
let referenceLine = null;
let measurementPoints = [];
let currentLine = null;
let isDrawingReference = false;
let isMeasuring = false;
let currentMeasurementType = 'length';
let stream = null;
let facingMode = "environment";
let isDragging = false;
let currentPosition = null;

// Initialize canvas
function initCanvas() {
    canvas.width = 600;
    canvas.height = 400;
    clearCanvas();
}

function clearCanvas() {
    ctx.fillStyle = '#f9f9f9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Redraw image if exists
    if (image) {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    }
    
    // Redraw reference line if exists
    if (referenceLine && referenceLine.start) {
        drawReferenceLine();
    }
    
    // Redraw measurement elements
    drawMeasurementElements();
}

function drawReferenceLine() {
    ctx.beginPath();
    ctx.moveTo(referenceLine.start.x, referenceLine.start.y);
    
    // If we have an end point, use it, otherwise use current mouse position
    if (referenceLine.end) {
        ctx.lineTo(referenceLine.end.x, referenceLine.end.y);
    } else if (currentPosition) {
        ctx.lineTo(currentPosition.x, currentPosition.y);
    }
    
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Add length text if reference line is complete
    if (referenceLine.end) {
        const midX = (referenceLine.start.x + referenceLine.end.x) / 2;
        const midY = (referenceLine.start.y + referenceLine.end.y) / 2;
        ctx.fillStyle = '#e74c3c';
        ctx.font = '14px Arial';
        ctx.fillText(`${knownLengthInput.value} ${unitSelector.value}`, midX + 10, midY);
    }
}

function drawMeasurementElements() {
    // Draw measurement points and lines
    if (measurementPoints.length > 0) {
        // Draw points
        ctx.fillStyle = '#2ecc71';
        for (const point of measurementPoints) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw connecting lines
        if (measurementPoints.length > 1) {
            ctx.beginPath();
            ctx.moveTo(measurementPoints[0].x, measurementPoints[0].y);
            for (let i = 1; i < measurementPoints.length; i++) {
                ctx.lineTo(measurementPoints[i].x, measurementPoints[i].y);
            }
            
            // Close the polygon if area measurement
            if (currentMeasurementType !== 'length' && measurementPoints.length > 2) {
                ctx.closePath();
            }
            
            ctx.strokeStyle = '#2ecc71';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
    
    // Draw current line being dragged
    if (isDragging && currentLine && currentLine.start && currentPosition) {
        ctx.beginPath();
        ctx.moveTo(currentLine.start.x, currentLine.start.y);
        ctx.lineTo(currentPosition.x, currentPosition.y);
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// Tab switching
cameraTab.addEventListener('click', function() {
    this.classList.add('active');
    uploadTab.classList.remove('active');
    cameraSource.style.display = 'block';
    uploadSource.style.display = 'none';
    videoContainer.style.display = 'block';
});

uploadTab.addEventListener('click', function() {
    this.classList.add('active');
    cameraTab.classList.remove('active');
    cameraSource.style.display = 'none';
    uploadSource.style.display = 'block';
    videoContainer.style.display = 'none';
    stopCamera();
});

// Measurement type selection
lengthOption.addEventListener('click', function() {
    setMeasurementType('length');
});

areaOption.addEventListener('click', function() {
    setMeasurementType('area');
});

volumeOption.addEventListener('click', function() {
    setMeasurementType('volume');
});

function setMeasurementType(type) {
    currentMeasurementType = type;
    lengthOption.classList.remove('active');
    areaOption.classList.remove('active');
    volumeOption.classList.remove('active');
    
    lengthResult.style.display = 'none';
    areaResult.style.display = 'none';
    volumeResult.style.display = 'none';
    volumeControls.style.display = 'none';
    completePolygonBtn.style.display = 'none';
    
    switch(type) {
        case 'length':
            lengthOption.classList.add('active');
            lengthResult.style.display = 'block';
            measurementInstructions.textContent = "Draw a line across the pothole to measure its length.";
            break;
        case 'area':
            areaOption.classList.add('active');
            areaResult.style.display = 'block';
            measurementInstructions.textContent = "Click around the edges of the pothole to measure its area. Click 'Complete Measurement' when done.";
            completePolygonBtn.style.display = 'inline-block';
            break;
        case 'volume':
            volumeOption.classList.add('active');
            volumeControls.style.display = 'block';
            volumeResult.style.display = 'block';
            measurementInstructions.textContent = "Click around the edges of the pothole to measure its area first. Then enter water depth.";
            completePolygonBtn.style.display = 'inline-block';
            break;
    }
    
    // Clear any existing measurements
    measurementPoints = [];
    currentLine = null;
    clearCanvas();
    clearMeasurementBtn.disabled = true;
    updateResults();
}

// Camera functions
async function startCamera() {
    try {
        videoContainer.style.display = 'block';
        stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });
        cameraFeed.srcObject = stream;
        startCameraBtn.disabled = true;
        captureBtn.disabled = false;
        flipCameraBtn.disabled = false;
    } catch (err) {
        console.error("Camera error: ", err);
        alert("Could not access camera. Please check permissions or try uploading an image instead.");
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        cameraFeed.srcObject = null;
        startCameraBtn.disabled = false;
        captureBtn.disabled = true;
        flipCameraBtn.disabled = true;
    }
}

function flipCamera() {
    facingMode = facingMode === "user" ? "environment" : "user";
    stopCamera();
    startCamera();
}

function capturePhoto() {
    if (!stream) return;
    
    // Set canvas dimensions to match video stream
    const videoWidth = cameraFeed.videoWidth;
    const videoHeight = cameraFeed.videoHeight;
    const aspectRatio = videoWidth / videoHeight;
    
    let drawWidth = 600;
    let drawHeight = 600 / aspectRatio;
    
    if (drawHeight > 400) {
        drawHeight = 400;
        drawWidth = 400 * aspectRatio;
    }
    
    canvas.width = drawWidth;
    canvas.height = drawHeight;
    
    // Draw video frame to canvas
    ctx.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);
    
    // Set image for measurement
    image = new Image();
    image.src = canvas.toDataURL('image/png');
    
    // Reset state
    referenceLine = null;
    measurementPoints = [];
    currentLine = null;
    scale = 0;
    isDrawingReference = false;
    isMeasuring = false;
    
    // Enable reference drawing
    drawReferenceBtn.disabled = false;
    clearReferenceBtn.disabled = true;
    measureBtn.disabled = true;
    clearMeasurementBtn.disabled = true;
    
    // Reset results
    updateResults();
}

// Event listeners for camera buttons
startCameraBtn.addEventListener('click', startCamera);
captureBtn.addEventListener('click', capturePhoto);
flipCameraBtn.addEventListener('click', flipCamera);

// Load image to canvas from file upload
imageUpload.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        image = new Image();
        image.onload = function() {
            // Reset state
            referenceLine = null;
            measurementPoints = [];
            currentLine = null;
            scale = 0;
            isDrawingReference = false;
            isMeasuring = false;
            
            // Draw image on canvas
            const aspectRatio = image.width / image.height;
            let drawWidth = 600;
            let drawHeight = 600 / aspectRatio;
            
            if (drawHeight > 400) {
                drawHeight = 400;
                drawWidth = 400 * aspectRatio;
            }
            
            canvas.width = drawWidth;
            canvas.height = drawHeight;
            
            ctx.drawImage(image, 0, 0, drawWidth, drawHeight);
            
            // Enable reference drawing
            drawReferenceBtn.disabled = false;
            clearReferenceBtn.disabled = true;
            measureBtn.disabled = true;
            clearMeasurementBtn.disabled = true;
            
            // Reset results
            updateResults();
        };
        image.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// Event listeners for measurement buttons
drawReferenceBtn.addEventListener('click', function() {
    isDrawingReference = true;
    isMeasuring = false;
    this.disabled = true;
    clearReferenceBtn.disabled = false;
    measureBtn.disabled = true;
    measurementInstructions.textContent = "Click and drag to draw a line on the reference object.";
});

clearReferenceBtn.addEventListener('click', function() {
    referenceLine = null;
    scale = 0;
    clearCanvas();
    drawReferenceBtn.disabled = false;
    this.disabled = true;
    measureBtn.disabled = true;
    updateResults();
});

measureBtn.addEventListener('click', function() {
    isDrawingReference = false;
    isMeasuring = true;
    measurementPoints = [];
    currentLine = null;
    clearCanvas();
    this.disabled = true;
    clearMeasurementBtn.disabled = false;
});

clearMeasurementBtn.addEventListener('click', function() {
    measurementPoints = [];
    currentLine = null;
    clearCanvas();
    this.disabled = true;
    updateResults();
});

completePolygonBtn.addEventListener('click', function() {
    if (measurementPoints.length > 2) {
        calculateMeasurement();
        isMeasuring = false;
        clearMeasurementBtn.disabled = false;
    }
});

// Canvas mouse events
canvas.addEventListener('mousedown', function(e) {
    if (!image) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentPosition = { x, y };
    
    if (isDrawingReference) {
        referenceLine = {
            start: { x, y },
            end: null
        };
        isDragging = true;
    } else if (isMeasuring) {
        if (currentMeasurementType === 'length' && measurementPoints.length >= 2) {
            measurementPoints = [];
        }
        currentLine = {
            start: { x, y },
            end: null
        };
        isDragging = true;
    }
});

canvas.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentPosition = { x, y };
    
    if (isDrawingReference && referenceLine) {
        referenceLine.end = currentPosition;
    } else if (isMeasuring && currentLine) {
        currentLine.end = currentPosition;
    }
    clearCanvas();
});

canvas.addEventListener('mouseup', function(e) {
    if (!isDragging) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentPosition = { x, y };
    
    if (isDrawingReference && referenceLine) {
        referenceLine.end = { x, y };
        
        // Calculate scale (pixels per unit)
        const knownLength = parseFloat(knownLengthInput.value);
        if (knownLength > 0) {
            const pixelLength = Math.sqrt(
                Math.pow(referenceLine.end.x - referenceLine.start.x, 2) + 
                Math.pow(referenceLine.end.y - referenceLine.start.y, 2)
            );
            scale = pixelLength / knownLength;
            
            // Enable measurement
            measureBtn.disabled = false;
            measurementInstructions.textContent = `Scale set. ${pixelLength.toFixed(1)} pixels = ${knownLength} ${unitSelector.value}. Now measure the pothole.`;
        } else {
            measurementInstructions.textContent = "Please enter a valid known length for the reference object.";
        }
        
        isDrawingReference = false;
    } else if (isMeasuring && currentLine) {
        currentLine.end = { x, y };
        measurementPoints.push(currentLine.start);
        
        // For length measurement, we only need two points
        if (currentMeasurementType === 'length' && measurementPoints.length === 2) {
            calculateMeasurement();
            isMeasuring = false;
            clearMeasurementBtn.disabled = false;
        }
        
        currentLine = null;
    }
    
    isDragging = false;
    clearCanvas();
});

canvas.addEventListener('dblclick', function(e) {
    if (isMeasuring && currentMeasurementType !== 'length' && measurementPoints.length > 2) {
        calculateMeasurement();
        isMeasuring = false;
        clearMeasurementBtn.disabled = false;
    }
});

// Calculate measurements based on points
function calculateMeasurement() {
    if (!scale || measurementPoints.length < 2) return;
    
    if (currentMeasurementType === 'length') {
        if (measurementPoints.length === 2) {
            const pixelLength = Math.sqrt(
                Math.pow(measurementPoints[1].x - measurementPoints[0].x, 2) + 
                Math.pow(measurementPoints[1].y - measurementPoints[0].y, 2)
            );
            const realLength = pixelLength / scale;
            lengthValue.textContent = `${realLength.toFixed(1)} ${unitSelector.value}`;
        }
    } else if (currentMeasurementType === 'area' || currentMeasurementType === 'volume') {
        // Calculate area using shoelace formula
        let area = 0;
        const n = measurementPoints.length;
        
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += measurementPoints[i].x * measurementPoints[j].y;
            area -= measurementPoints[j].x * measurementPoints[i].y;
        }
        
        area = Math.abs(area) / 2;
        const realArea = area / (scale * scale); // Convert to real units squared
        
        areaValue.textContent = `${realArea.toFixed(2)} ${unitSelector.value}²`;
        
        if (currentMeasurementType === 'volume') {
            const depth = parseFloat(waterDepthInput.value) || 0;
            const shape = potholeShapeSelect.value;
            let volume = 0;
            
            // Apply shape-specific volume calculations
            switch(shape) {
                case 'circular':
                    // Approximate as cylinder: πr²h (using area as πr²)
                    volume = realArea * depth;
                    break;
                case 'rectangular':
                    // Area × depth
                    volume = realArea * depth;
                    break;
                case 'elliptical':
                    // Approximate as elliptical cylinder: πab × depth
                    volume = realArea * depth;
                    break;
            }
            
            volumeValue.textContent = `${volume.toFixed(2)} ${unitSelector.value}³`;
        }
    }
}

// Update all result displays
function updateResults() {
    lengthValue.textContent = "-";
    areaValue.textContent = "-";
    volumeValue.textContent = "-";
}

// Update volume when depth changes
waterDepthInput.addEventListener('input', function() {
    if (currentMeasurementType === 'volume' && measurementPoints.length > 2) {
        calculateMeasurement();
    }
});

// Initialize
initCanvas();

// Stop camera when page is closed
window.addEventListener('beforeunload', function() {
    stopCamera();
});