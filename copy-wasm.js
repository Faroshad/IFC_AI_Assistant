import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure directories exist
const publicDir = join(__dirname, 'public');
const wasmDir = join(publicDir, 'wasm');

[publicDir, wasmDir].forEach(dir => {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
});

// Function to safely copy a file
function safeCopyFile(src, dest, description) {
    try {
        if (existsSync(src)) {
            copyFileSync(src, dest);
            console.log(`Copied ${description} to ${dest}`);
            return true;
        }
        console.warn(`Source file not found: ${src}`);
        return false;
    } catch (error) {
        console.error(`Error copying ${description}:`, error);
        return false;
    }
}

// Copy WASM files from web-ifc
const wasmFiles = [
    {
        src: join(__dirname, 'node_modules', 'web-ifc', 'web-ifc.wasm'),
        dest: join(wasmDir, 'web-ifc.wasm'),
        desc: 'web-ifc.wasm'
    },
    {
        src: join(__dirname, 'node_modules', 'web-ifc', 'web-ifc-mt.wasm'),
        dest: join(wasmDir, 'web-ifc-mt.wasm'),
        desc: 'web-ifc-mt.wasm'
    }
];

// Copy WASM files
wasmFiles.forEach(file => {
    safeCopyFile(file.src, file.dest, file.desc);
});

// Try to copy IFCWorker.js from multiple possible locations
const workerLocations = [
    join(__dirname, 'node_modules', 'web-ifc-three', 'IFCWorker.js'),
    join(__dirname, 'node_modules', 'web-ifc-three', 'dist', 'IFCWorker.js'),
    join(__dirname, 'node_modules', 'three', 'examples', 'jsm', 'loaders', 'ifc', 'IFCWorker.js'),
    join(__dirname, 'node_modules', '@types', 'web-ifc-three', 'IFCWorker.js')
];

let workerCopied = false;
for (const workerSrc of workerLocations) {
    if (safeCopyFile(workerSrc, join(wasmDir, 'IFCWorker.js'), 'IFCWorker.js')) {
        workerCopied = true;
        break;
    }
}

if (!workerCopied) {
    console.error('Failed to copy IFCWorker.js from any known location');
    process.exit(1);
} 