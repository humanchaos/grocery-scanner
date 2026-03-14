const fs = require('fs');
const path = require('path');

class PromptLoader {
  constructor() {
    this.agentsDir = path.join(__dirname, '..', '.agent', 'agents');
    this.prompts = {};
    this.watchers = {};
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(this.agentsDir)) {
      fs.mkdirSync(this.agentsDir, { recursive: true });
    }

    this.loadAllPrompts();

    // Watch the directory itself for new or deleted files
    fs.watch(this.agentsDir, (eventType, filename) => {
      if (filename && filename.endsWith('.md')) {
        console.log(`[PromptLoader] Detected ${eventType} on ${filename}. Reloading...`);
        this.loadAllPrompts();
      }
    });
  }

  loadAllPrompts() {
    try {
      if (!fs.existsSync(this.agentsDir)) return;

      const files = fs.readdirSync(this.agentsDir).filter(file => file.endsWith('.md'));
      
      const newPrompts = {};
      
      for (const file of files) {
        // Agent name from filename: "Detailed_Vision_Agent.md" -> "Detailed Vision Agent"
        const agentName = path.basename(file, '.md').replace(/_/g, ' ').trim();
        const filePath = path.join(this.agentsDir, file);
        
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          // Strip potential leading/trailing markdown code blocks if the user wrapped it
          let prompt = content.trim();
          
          // Optional: if the markdown file contains a "# Agent Name" heading, we could strip it
          const lines = prompt.split('\n');
          if (lines[0].startsWith('#')) {
            lines.shift();
            prompt = lines.join('\n').trim();
          }
          
          const codeBlockMatch = prompt.match(/```(?:text)?\s*([\s\S]*?)```/);
          if (codeBlockMatch) {
            newPrompts[agentName] = codeBlockMatch[1].trim();
          } else {
            newPrompts[agentName] = prompt;
          }
        } catch (err) {
          console.error(`[PromptLoader] Error reading prompt file ${file}:`, err.message);
        }
      }

      this.prompts = newPrompts;
      console.log(`[PromptLoader] Successfully loaded prompts for: ${Object.keys(this.prompts).join(', ')}`);
    } catch (err) {
      console.error('[PromptLoader] Error loading prompts from directory:', err.message);
    }
  }

  getPrompt(agentName, defaultPrompt = '') {
    // Attempt exact match first
    if (this.prompts[agentName]) return this.prompts[agentName];
    
    // Case-insensitive match or match with underscores replaced
    const normalizedTarget = agentName.toLowerCase().replace(/_/g, ' ');
    for (const key of Object.keys(this.prompts)) {
      if (key.toLowerCase().replace(/_/g, ' ') === normalizedTarget) {
        return this.prompts[key];
      }
    }
    
    return defaultPrompt;
  }
}

// Export a singleton instance so memory and watchers are shared
const promptLoaderInstance = new PromptLoader();
module.exports = promptLoaderInstance;
