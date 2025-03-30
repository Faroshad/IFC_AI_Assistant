import os
import json
from transformers import pipeline
from dotenv import load_dotenv

# Load environment variables if needed (e.g., for other settings)
load_dotenv()

def generate_summary(summarizer, description):
    # If the description is very short, just return it.
    if len(description.split()) < 20:
        return description
    # Adjust max_length and min_length based on the input length.
    # For instance, if input length is ~87 tokens, use max_length=43.
    result = summarizer(description, max_length=43, min_length=20, do_sample=False)
    return result[0]['summary_text']


def main():
    # Load the IFC full JSON (generated from your JS extractor)
    with open("../ifc_full.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    
    elements = data.get("elements", [])
    faiss_docs = []

    for element in elements:
        basic = element.get("BasicProperties", {})
        ps = element.get("PropertySets", {})
        type_name = element.get("type", "")
        express_id = element.get("expressID", "")
        
        # Build a description string from basic properties and property sets.
        description = (
            f"Element type: {type_name}. ExpressID: {express_id}. "
            f"GlobalId: {basic.get('GlobalId', '')}. Name: {basic.get('Name', '')}. "
            f"ObjectType: {basic.get('ObjectType', '')}. "
            f"PropertySets: {json.dumps(ps)}"
        )
        
        # Generate a summary for the description using the summarizer pipeline.
        summary = generate_summary(summarizer, description)
        
        # Construct the FAISS document.
        doc = {
            "content": summary,
            "metadata": {
                "type": type_name,
                "expressID": express_id,
                "name": basic.get("Name", "")
            }
        }
        faiss_docs.append(doc)
    
    # Write the FAISS documents to a JSON file.
    with open("faiss_docs.json", "w", encoding="utf-8") as f:
        json.dump(faiss_docs, f, indent=2)
    
    print("FAISS documents exported to 'faiss_docs.json'")

if __name__ == "__main__":
    # Load the summarization pipeline from Hugging Face.
    # You can try other summarization models if desired.
    summarizer = pipeline("summarization", model="facebook/bart-large-cnn")
    main()
