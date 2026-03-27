// Material Sheet Optimization Logic in JavaScript

// 1. Material Management
class Material {
    constructor(name, width, height, grainDirection) {
        this.name = name;
        this.width = width;
        this.height = height;
        this.grainDirection = grainDirection; // 0 for horizontal, 1 for vertical
    }
}

// 2. Cut List Handling
class CutPiece {
    constructor(type, dimensions) {
        this.type = type; // 'rectangle', 'triangle', 'trapezoid'
        this.dimensions = dimensions; // For rectangles: {width, height}, for triangle: {base, height}, for trapezoid: {base1, base2, height}
    }
}

// Function to calculate area of each shape
function calculateArea(cutPiece) {
    switch (cutPiece.type) {
        case 'rectangle':
            return cutPiece.dimensions.width * cutPiece.dimensions.height;
        case 'triangle':
            return 0.5 * cutPiece.dimensions.base * cutPiece.dimensions.height;
        case 'trapezoid':
            return 0.5 * (cutPiece.dimensions.base1 + cutPiece.dimensions.base2) * cutPiece.dimensions.height;
        default:
            return 0;
    }
}

// 3. Bin Packing Algorithm (Simplified Example)
function binPacking(material, cutList) {
    let totalArea = material.width * material.height;
    let usedArea = 0;

    cutList.forEach(piece => {
        usedArea += calculateArea(piece);
    });

    return { totalArea, usedArea, waste: totalArea - usedArea };
}

// 4. Grain Direction Constraints (Basic implementation)
function checkGrainDirection(material, cutPiece) {
    // Example logic based on height and width considering grain direction
    if (material.grainDirection === 0 && cutPiece.dimensions.height > material.height) {
        return false; // Fail if height exceeds and grain direction is horizontal
    }
    return true;
}

// 5. Material Calculations Example
function calculateEfficiency(material, usedArea) {
    return (usedArea / (material.width * material.height)) * 100;
}

// 6. Export Functionality
function exportCutList(cutList) {
    // For simplicity, exporting to JSON format
    return JSON.stringify(cutList, null, 2);
}

// Example Usage
const material = new Material('Plywood', 2440, 1220, 0);
const cutList = [
    new CutPiece('rectangle', { width: 600, height: 800 }),
    new CutPiece('triangle', { base: 400, height: 300 }),
    new CutPiece('trapezoid', { base1: 300, base2: 500, height: 400 })
];

if (checkGrainDirection(material, cutList[0])) {
    const packingResult = binPacking(material, cutList);
    console.log(`Total Area: ${packingResult.totalArea}, Used Area: ${packingResult.usedArea}, Waste: ${packingResult.waste}`);
    console.log(`Efficiency: ${calculateEfficiency(material, packingResult.usedArea)}%`);
    console.log('Exported Cut List:', exportCutList(cutList));
} else {
    console.log('Cut piece does not comply with grain direction constraints.');
} 
