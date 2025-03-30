import { IfcAPI } from 'web-ifc';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Set up __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define file paths (adjust if needed)
const modelPath = path.resolve(__dirname, '../models/building.ifc');
const outputPath = path.resolve(__dirname, '../ifc_full.json');

// Define which property sets to extract (adjust as needed)
const targetPsets = [
  'Pset_ElementShading',
  'Pset_ProductRequirements',
  'Pset_QuantityTakeOff',
  'Pset_ReinforcementBarPitchOfSlab',
  'Pset_SlabCommon',
  'Pset_ReinforcementBarPitchOfWall',
  'Pset_WallCommon'
];

/**
 * Main function:
 *  - Opens the IFC model.
 *  - Iterates over every express ID.
 *  - Extracts basic properties (GlobalId, Name, ObjectType),
 *    filtered property sets (based on targetPsets), and a raw copy of the IFC line.
 *  - Writes all extracted elements into a JSON file.
 */
async function extractIFCFullData() {
  const ifcAPI = new IfcAPI();
  await ifcAPI.Init();

  const fileData = await fs.readFile(modelPath);
  const modelID = ifcAPI.OpenModel(fileData);
  const maxID = ifcAPI.GetMaxExpressID(modelID);

  const elements = [];

  for (let i = 1; i <= maxID; i++) {
    const item = ifcAPI.GetLine(modelID, i);
    if (!item || item.type === undefined) continue;

    // Convert numeric type code to a human-readable type name
    const typeName = ifcAPI.GetNameFromTypeCode(item.type);
    const expressID = item.expressID;

    // Extract basic properties
    const BasicProperties = {
      GlobalId: item.GlobalId?.value || '',
      Name: item.Name?.value || '',
      ObjectType: item.ObjectType?.value || '',
    };

    // Extract property sets from IsDefinedBy
    const PropertySets = {};
    const defs = item.IsDefinedBy || [];
    for (const rel of defs) {
      const relItem = ifcAPI.GetLine(modelID, rel.value);
      if (!relItem || relItem.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
      const propDefID = relItem.RelatingPropertyDefinition?.value;
      if (!propDefID) continue;
      const propDef = ifcAPI.GetLine(modelID, propDefID);
      const psetName = propDef?.Name?.value;
      if (!psetName || !targetPsets.includes(psetName)) continue;
      const props = {};
      const propsList = propDef.HasProperties || [];
      for (const prop of propsList) {
        const propLine = ifcAPI.GetLine(modelID, prop.value);
        const name = propLine?.Name?.value;
        const value = propLine?.NominalValue?.value ?? propLine?.NominalValue ?? propLine?.value ?? null;
        if (name && value !== null) {
          props[name] = value;
        }
      }
      if (Object.keys(props).length > 0) {
        PropertySets[psetName] = props;
      }
    }

    // Construct the full element object
    const element = {
      expressID,
      type: typeName,
      BasicProperties,
      PropertySets,
      RawIFC: item
    };

    elements.push(element);
  }

  // Write out the full extracted data as a JSON file.
  const finalOutput = { elements };
  await fs.writeFile(outputPath, JSON.stringify(finalOutput, null, 2), 'utf8');
  console.log(`✅ Full IFC data exported to: ${outputPath}`);

  ifcAPI.CloseModel(modelID);
}

extractIFCFullData().catch(err => {
  console.error("❌ Error extracting IFC data:", err);
});
