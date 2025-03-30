import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { IFCLoader } from 'web-ifc-three/IFCLoader';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import {
    IFCWALLSTANDARDCASE,
    IFCDOOR,
    IFCSLAB
} from 'web-ifc';
import './styles.css';

// Apply BVH for improved performance
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// Global variables and a counter for unique model IDs
let scene, camera, renderer, controls;
let ifcLoader, ifcModels = [];
let raycaster, mouse;
let preselectMat, selectMat, preselectModel;
const canvas = document.getElementById('canvas');
const propertyMenu = document.getElementById('property-menu');
const propertiesContainer = document.getElementById('properties-container');
const closeButton = document.querySelector('.close-button');
const elementId = document.getElementById('element-id');
let modelIDCounter = 0;

// Set up scene, camera, renderer and controls
function setupScene() {
    console.log('Setting up scene...');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb0b0b0);
    
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(8, 13, 15);
    
    renderer = new THREE.WebGLRenderer({ 
        canvas,
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.minDistance = 1;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 1.5;
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);
    
    const gridHelper = new THREE.GridHelper(50, 50);
    scene.add(gridHelper);
    
    raycaster = new THREE.Raycaster();
    raycaster.firstHitOnly = true;
    mouse = new THREE.Vector2();
    
    preselectMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.6,
        color: 0xff88ff,
        depthTest: false
    });
    
    selectMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.6,
        color: 0xff00ff,
        depthTest: false
    });
}

// Define handlePreselection to highlight elements under the mouse
function handlePreselection(event) {
    if (!ifcModels.length) return;
    
    const bounds = canvas.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    const y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    mouse.x = x;
    mouse.y = y;
    
    raycaster.setFromCamera(mouse, camera);
    
    if (preselectModel) {
        scene.remove(preselectModel);
        preselectModel = null;
    }
    
    const intersects = raycaster.intersectObjects(ifcModels);
    if (intersects.length) {
        const intersect = intersects[0];
        const model = intersect.object;
        const faceIndex = intersect.faceIndex;
        
        if (!model || !model.geometry || faceIndex === undefined || model.userData?.modelID === undefined) {
            console.warn("Skipping highlight: incomplete intersection data");
            return;
        }
        
        try {
            const id = ifcLoader.ifcManager.getExpressId(model.geometry, faceIndex);
            if (id !== undefined) {
                preselectModel = ifcLoader.ifcManager.createSubset({
                    modelID: model.userData.modelID,
                    ids: [id],
                    material: preselectMat,
                    scene: scene,
                    removePrevious: true
                });
            }
        } catch (error) {
            console.error("Error in handlePreselection:", error);
        }
    }
}

// Initialize the IFC loader and setup BVH
async function initializeIFCLoader() {
    try {
        ifcLoader = new IFCLoader();
        await ifcLoader.ifcManager.setWasmPath('./');
        ifcLoader.ifcManager.setupThreeMeshBVH(
            computeBoundsTree,
            disposeBoundsTree,
            acceleratedRaycast
        );
        console.log('IFC Loader initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing IFC Loader:', error);
        showError(`Failed to initialize IFC Loader: ${error.message}`);
        return false;
    }
}

// Recursively traverse the spatial structure and log each element's features
async function traverseAndLogFeatures(node, modelID, depth = 0) {
    const indent = ' '.repeat(depth * 2);
    if (node.expressID) {
        try {
            const props = await ifcLoader.ifcManager.getItemProperties(modelID, node.expressID);
            console.log(
              `${indent}Element ID: ${node.expressID}, Name: ${node.Name ? node.Name.value : 'N/A'}`,
              props
            );
        } catch (error) {
            console.error(`${indent}Error fetching properties for Element ID: ${node.expressID}`, error);
        }
    } else {
        console.log(`${indent}Node (no expressID):`, node);
    }
    if (node.children && node.children.length > 0) {
        for (const child of node.children) {
            await traverseAndLogFeatures(child, modelID, depth + 1);
        }
    }
}

// Retrieve and log spatial structure with features for a given modelID
async function logAllElementsWithFeatures(modelID) {
    try {
         console.log("Retrieving spatial structure for modelID:", modelID);
         const spatialStructure = await ifcLoader.ifcManager.getSpatialStructure(modelID, true);
         console.log("Spatial Structure:", spatialStructure);
         await traverseAndLogFeatures(spatialStructure, modelID);
         console.log("Finished logging all elements and features.");
    } catch (error) {
         console.error("Error retrieving spatial structure:", error);
    }
}

// Load an IFC model, assign a unique modelID, center the view, and log its structure
async function loadIFCModel(url) {
    console.log(`Loading IFC model from: ${url}`);
    if (!ifcLoader) {
        console.error('IFC Loader not initialized');
        return;
    }
    
    // Show loading progress in the console
    ifcLoader.ifcManager.setOnProgress((event) => {
        const { loaded, total } = event;
        const progress = Math.floor((loaded / total) * 100);
        console.log(`Loading: ${progress}%`);
    });
    
    try {
        // Clear previous models from scene and dispose resources
        ifcModels.forEach((model) => {
            scene.remove(model);
            if (model.geometry) model.geometry.dispose();
            if (model.material) {
                if (Array.isArray(model.material)) {
                    model.material.forEach(mat => mat.dispose());
                } else {
                    model.material.dispose();
                }
            }
        });
        ifcModels = [];
        
        // Load the new model and add it to the scene
        const ifcModel = await ifcLoader.loadAsync(url);
        // Assign a unique modelID if not already provided
        if (ifcModel.userData.modelID === undefined) {
            ifcModel.userData.modelID = modelIDCounter++;
        }
        scene.add(ifcModel);
        ifcModels.push(ifcModel);
        
        // Center the camera on the model
        const box = new THREE.Box3().setFromObject(ifcModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        controls.target.copy(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2;
        const direction = new THREE.Vector3(1, 1, 1).normalize();
        camera.position.copy(center.clone().add(direction.multiplyScalar(distance)));
        camera.updateProjectionMatrix();
        controls.update();
        
        const modelID = ifcModel.userData.modelID;
        console.log("IFC Model loaded:", ifcModel);
        console.log("Using Model ID:", modelID);
        
        // Log spatial structure and element features
        await logAllElementsWithFeatures(modelID);
        
        // Log specific element types for additional verification
        const walls = await ifcLoader.ifcManager.getAllItemsOfType(modelID, IFCWALLSTANDARDCASE, false);
        console.log("Walls:", walls);
        const slabs = await ifcLoader.ifcManager.getAllItemsOfType(modelID, IFCSLAB, false);
        console.log("Slabs:", slabs);
        const doors = await ifcLoader.ifcManager.getAllItemsOfType(modelID, IFCDOOR, false);
        console.log("Doors:", doors);
        
        return ifcModel;
    } catch (error) {
        console.error('Error loading IFC model:', error);
        showError(`Failed to load IFC model: ${error.message}`);
        return null;
    }
}

// Updated handleSelection with extra error handling for all imported models
async function handleSelection(event) {
    if (!ifcModels.length) return;
    
    const bounds = canvas.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    const y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    mouse.x = x;
    mouse.y = y;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(ifcModels);
    if (intersects.length === 0) return;
    
    const intersect = intersects[0];
    const model = intersect.object;
    const faceIndex = intersect.faceIndex;
    
    if (!model || !model.geometry || faceIndex === undefined || model.userData?.modelID === undefined) {
        console.warn("Skipping selection: incomplete intersect data");
        return;
    }
    
    let id;
    try {
        id = ifcLoader.ifcManager.getExpressId(model.geometry, faceIndex);
        console.log("handleSelection: Retrieved Express ID:", id);
    } catch (err) {
        console.error("Error getting express ID:", err);
        return;
    }
    if (id === undefined) {
        console.warn("Express ID undefined — skipping.");
        return;
    }
    
    const modelID = model.userData.modelID;
    console.log("handleSelection: Getting properties for modelID", modelID, "and expressID", id);
    
    try {
        const props = await ifcLoader.ifcManager.getItemProperties(modelID, id);
        const type = await ifcLoader.ifcManager.getIfcType(modelID, id);
        const psets = await ifcLoader.ifcManager.getPropertySets(modelID, id);
        
        console.log("Selected Element ID:", id);
        console.log("Properties:", props);
        console.log("IFC Type:", type);
        console.log("Property Sets:", psets);
        
        displayProperties(props, type, psets, id);
    } catch (err) {
        console.error("Error while accessing IFC data for selected element:", err);
        showError("Could not load IFC element properties.");
    }
}

// Display element properties in the UI
function displayProperties(properties, type, psets, expressID) {
    propertyMenu.style.display = 'block';
    propertiesContainer.innerHTML = '';
    elementId.textContent = `${type} #${expressID}`;
    
    const basicProps = document.createElement('div');
    basicProps.className = 'property-group';
    
    const basicTitle = document.createElement('h3');
    basicTitle.className = 'property-title';
    basicTitle.textContent = 'Basic Properties';
    basicProps.appendChild(basicTitle);
    
    const relevantProps = ['GlobalId', 'Name', 'Description', 'ObjectType'];
    relevantProps.forEach(propName => {
        if (properties[propName] !== undefined && properties[propName] !== null) {
            const propDiv = document.createElement('div');
            propDiv.className = 'property-item';
            
            const propNameSpan = document.createElement('span');
            propNameSpan.textContent = propName;
            
            const propValueSpan = document.createElement('span');
            propValueSpan.textContent = properties[propName].value || properties[propName];
            
            propDiv.appendChild(propNameSpan);
            propDiv.appendChild(propValueSpan);
            basicProps.appendChild(propDiv);
        }
    });
    
    propertiesContainer.appendChild(basicProps);
    
    if (psets && psets.length > 0) {
        psets.forEach(pset => {
            if (pset.HasProperties && pset.HasProperties.length > 0) {
                const psetDiv = document.createElement('div');
                psetDiv.className = 'property-group';
                
                const psetTitle = document.createElement('h3');
                psetTitle.className = 'property-title';
                psetTitle.textContent = pset.Name?.value || 'Property Set';
                psetDiv.appendChild(psetTitle);
                
                pset.HasProperties.forEach(prop => {
                    if (prop.Name && (prop.NominalValue || prop.value)) {
                        const propDiv = document.createElement('div');
                        propDiv.className = 'property-item';
                        
                        const propNameSpan = document.createElement('span');
                        propNameSpan.textContent = prop.Name.value;
                        
                        const propValueSpan = document.createElement('span');
                        const value = prop.NominalValue ? prop.NominalValue.value : prop.value;
                        propValueSpan.textContent = value;
                        
                        propDiv.appendChild(propNameSpan);
                        propDiv.appendChild(propValueSpan);
                        psetDiv.appendChild(propDiv);
                    }
                });
                
                propertiesContainer.appendChild(psetDiv);
            }
        });
    }
}

// Setup file upload and UI events
function setupUploadHandler() {
    const fileInput = document.getElementById('file-input');
    const uploadButton = document.getElementById('upload-button');
    
    uploadButton.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file && file.name.endsWith('.ifc')) {
            const url = URL.createObjectURL(file);
            loadIFCModel(url);
        } else {
            showError('Please select a valid IFC file (.ifc)');
        }
    });
    
    closeButton.addEventListener('click', () => {
        propertyMenu.style.display = 'none';
    });
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Initialize the application
async function init() {
    setupScene();
    
    const loaderInitialized = await initializeIFCLoader();
    if (!loaderInitialized) {
        showError('Failed to initialize IFC loader');
        return;
    }
    
    window.addEventListener('resize', onWindowResize);
    canvas.addEventListener('mousemove', handlePreselection);
    canvas.addEventListener('click', handleSelection);
    setupUploadHandler();
    
    // Load a default model if available; otherwise, use file upload.
    const modelPath = './models/building.ifc';
    try {
        await loadIFCModel(modelPath);
    } catch (error) {
        console.log('No default model found. Please upload an IFC file.');
    }
    
    animate();
}

init();
