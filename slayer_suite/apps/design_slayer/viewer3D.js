/**
 * viewer3d.js
 * This module handles all the Three.js logic for the 3D preview modal.
 */

import { state } from './state.js';
import { LAYER_DEFINITIONS, SCALE_FACTOR } from './config.js';

// --- Private module variables for the 3D scene ---
let scene, camera, renderer, animationId;

// --- DOM Element Selectors ---
const getElement = id => document.getElementById(id);

// Create a lazy-loaded DOM object that queries elements only when accessed
const dom = new Proxy(
    {},
    {
        get(target, prop) {
            if (target[prop]) return target[prop];

            const elementMappings = {
                container: () => getElement('threejs-container'),
                resetViewBtn: () => getElement('viewer-reset-btn'),
                frontViewBtn: () => getElement('viewer-front-btn'),
                backViewBtn: () => getElement('viewer-back-btn'),
                sideViewBtn: () => getElement('viewer-side-btn')
            };

            if (elementMappings[prop]) {
                target[prop] = elementMappings[prop]();
                return target[prop];
            }

            return null;
        }
    }
);

/**
 * Initializes the 3D viewer, sets up the scene, camera, renderer, and controls.
 */
export function init3DViewer() {
    console.log('init3DViewer called');

    if (!dom.container) {
        console.error('Three.js container not found');
        return;
    }

    // Check if THREE is available
    if (typeof THREE === 'undefined') {
        console.error('THREE.js library not loaded!');
        // Try to show error message in container
        if (dom.container) {
            dom.container.innerHTML =
                '<div style="color: #f07727; text-align: center; padding: 40px;">THREE.js library not loaded. Please check if the library is properly included.</div>';
        }
        return;
    }

    // Clear any existing renderer
    if (renderer) {
        cleanup3DViewer();
    }

    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    // Get container dimensions - ensure it has size
    const containerWidth = dom.container.offsetWidth || 800;
    const containerHeight = dom.container.offsetHeight || 600;

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, containerWidth / containerHeight, 0.1, 1000);
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerWidth, containerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    dom.container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 10.0);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Add second directional light from opposite angle
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight2.position.set(-5, 10, -5);
    scene.add(directionalLight2);

    // Create the 3D sign model from the current layers
    create3DSign();

    // Setup user interaction controls
    setupSimpleOrbitControls();

    // Start the render loop
    console.log('Starting animation loop');
    animate();

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    console.log('init3DViewer completed successfully');
}

/**
 * Creates the 3D sign geometry from the layers on the canvas.
 */
function create3DSign() {
    const canvasLayers = state.layersList.filter(layer => layer.onCanvas);
    console.log('Creating 3D sign with', canvasLayers.length, 'layers');
    if (canvasLayers.length === 0) return;

    // Center the model based on the bounding box of all layers
    let centerX = 0,
        centerY = 0;
    canvasLayers.forEach(layer => {
        centerX += layer.x / SCALE_FACTOR + layer.width / 2;
        centerY += layer.y / SCALE_FACTOR + layer.height / 2;
    });
    centerX /= canvasLayers.length;
    centerY /= canvasLayers.length;

    let zOffset = 0;

    // Create a 3D box for each layer
    canvasLayers.forEach(layer => {
        const geometry = new THREE.BoxGeometry(layer.width, layer.height, layer.thickness);
        const color = new THREE.Color(layer.color || LAYER_DEFINITIONS[layer.type].color);

        // Use different materials for a more realistic look
        let material;
        switch (layer.material) {
            case 'acrylic':
                material = new THREE.MeshPhongMaterial({
                    color,
                    transparent: true,
                    opacity: 0.9,
                    shininess: 100
                });
                break;
            case 'aluminum':
                material = new THREE.MeshStandardMaterial({
                    color,
                    metalness: 0.9,
                    roughness: 0.1
                });
                break;
            case 'vinyl':
                material = new THREE.MeshLambertMaterial({ color });
                break;
            default:
                material = new THREE.MeshPhongMaterial({ color });
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.x = layer.x / SCALE_FACTOR + layer.width / 2 - centerX;
        mesh.position.y = -(layer.y / SCALE_FACTOR + layer.height / 2 - centerY); // Flip Y axis
        mesh.position.z = zOffset + layer.thickness / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        scene.add(mesh);
        zOffset += layer.thickness;
    });
}

/**
 * Sets up simple mouse-based orbit controls.
 */
function setupSimpleOrbitControls() {
    if (!dom.container) {
        console.error('Container not found for orbit controls');
        return;
    }

    let isMouseDown = false;
    let mouseX = 0,
        mouseY = 0;
    let targetX = 0,
        targetY = 0;
    let targetDistance = 15;
    let currentDistance = 15;

    const updateCameraPosition = () => {
        currentDistance += (targetDistance - currentDistance) * 0.1;
        camera.position.x = Math.cos(targetX) * Math.cos(targetY) * currentDistance;
        camera.position.y = Math.sin(targetY) * currentDistance;
        camera.position.z = Math.sin(targetX) * Math.cos(targetY) * currentDistance;
        camera.lookAt(0, 0, 0);
    };

    dom.container.addEventListener('mousedown', e => {
        isMouseDown = true;
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    dom.container.addEventListener('mousemove', e => {
        if (!isMouseDown) return;
        targetX += (e.clientX - mouseX) * 0.01;
        targetY += (e.clientY - mouseY) * 0.01;
        mouseX = e.clientX;
        mouseY = e.clientY;
        updateCameraPosition();
    });

    dom.container.addEventListener('mouseup', () => {
        isMouseDown = false;
    });
    dom.container.addEventListener('mouseleave', () => {
        isMouseDown = false;
    });

    dom.container.addEventListener('wheel', e => {
        e.preventDefault();
        targetDistance += e.deltaY * 0.01;
        targetDistance = Math.max(5, Math.min(50, targetDistance)); // Clamp zoom
        updateCameraPosition();
    });
}

/**
 * The main render loop.
 */
function animate() {
    if (!state.isModalOpen) {
        console.log('Animation stopped - modal not open');
        return;
    }
    animationId = requestAnimationFrame(animate);
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    } else {
        console.error('Missing renderer, scene or camera');
    }
}

/**
 * Handles window resize events to keep the viewer proportional.
 */
function onWindowResize() {
    if (!state.isModalOpen || !renderer || !dom.container) return;
    camera.aspect = dom.container.offsetWidth / dom.container.offsetHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(dom.container.offsetWidth, dom.container.offsetHeight);
}

/**
 * Cleans up the 3D scene, renderer, and event listeners when the modal is closed.
 */
export function cleanup3DViewer() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    if (renderer) {
        if (dom.container && renderer.domElement) {
            dom.container.removeChild(renderer.domElement);
        }
        renderer.dispose();
        renderer = null;
    }

    if (scene) {
        while (scene.children.length > 0) {
            const object = scene.children[0];
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(mat => mat.dispose());
                } else {
                    object.material.dispose();
                }
            }
            scene.remove(object);
        }
        scene = null;
    }

    camera = null;
    window.removeEventListener('resize', onWindowResize);
}
