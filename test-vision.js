const fs = require('fs');
const VisionAgent = require('./agents/visionAgent');
require('dotenv').config();

async function run() {
  const agent = new VisionAgent(process.env.GEMINI_API_KEY);
  const imagePath = '/Users/mmooslechner/Downloads/2022-09-05-billa-pflanzilla-01 (1).jpg';
  
  if (!fs.existsSync(imagePath)) {
    console.error('Image not found:', imagePath);
    return;
  }
  
  const base64Image = fs.readFileSync(imagePath, { encoding: 'base64' });
  console.log('Testing with image:', imagePath);
  
  const result = await agent.analyze(base64Image, 'image/jpeg');
  if (result.success) {
    console.log(`Found ${result.products.length} products:`);
    result.products.forEach(p => console.log(`- ${p.name} (${p.brand}) [${p.category}]`));
  } else {
    console.error('Error:', result.error);
  }
}

run();
