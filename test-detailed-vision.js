require('dotenv').config();
const fs = require('fs');
const DetailedVisionAgent = require('./agents/detailedVisionAgent');

async function testDetailedVision() {
  const imagePath = process.argv[2] || '/Users/mmooslechner/Downloads/2022-09-05-billa-pflanzilla-01 (1).jpg';
  
  if (!fs.existsSync(imagePath)) {
    console.error(`Error: Could not find image at ${imagePath}`);
    process.exit(1);
  }

  console.log(`Testing with image: ${imagePath}`);
  
  // Read file to base64
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    console.error("Please set GEMINI_API_KEY in .env");
    process.exit(1);
  }

  // Use the Detailed Vision Agent which now has 3x3 grid slicing built in
  const visionAgent = new DetailedVisionAgent(apiKey);
  
  const result = await visionAgent.analyzeDetail(base64Image, 'image/jpeg');
  
  if (result.success) {
    console.log(`\nFound ${result.products.length} products:`);
    result.products.forEach(p => {
      console.log(`- ${p.name} (${p.brand}) [${p.category}] - Bounding Box: ${JSON.stringify(p.boundingBox)}`);
    });
  } else {
    console.error('\nAnalysis failed:', result.error);
  }
}

testDetailedVision();
