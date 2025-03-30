# IFC Model Viewer

A web-based IFC model viewer built with Three.js and web-ifc-three. This application allows you to load and view IFC (Industry Foundation Classes) models along with their BIM (Building Information Modeling) data.

## Features

- 3D visualization of IFC models
- Interactive orbit controls for navigating the model
- BIM property inspection for model elements
- Upload custom IFC files through the browser
- Automatic detection of house.ifc model in the models folder

## Usage

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Place your IFC model files in the `models` folder (optional)
4. Start the development server:
   ```
   npm run dev
   ```
5. Open your browser and navigate to the URL shown in the terminal

## Interacting with the Model

- **Orbit**: Click and drag to rotate the model
- **Pan**: Right-click and drag to pan
- **Zoom**: Use the mouse wheel to zoom in and out
- **Select elements**: Click on an element to view its BIM properties
- **Load a model**: Click the "Load IFC Model" button to upload an IFC file

## Technologies Used

- [Three.js](https://threejs.org/) - 3D WebGL library
- [web-ifc](https://ifcjs.github.io/info/) - IFC parsing library
- [web-ifc-three](https://github.com/IFCjs/web-ifc-three) - IFC loader for Three.js
- [Vite](https://vitejs.dev/) - Development server and build tool

## License

MIT 