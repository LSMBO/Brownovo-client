// Template loader utility
// Loads HTML templates from separate files into the DOM

async function loadTemplate(templatePath, templateId) {
  try {
    const response = await fetch(templatePath);
    if (!response.ok) {
      throw new Error(`Failed to load template: ${templatePath}`);
    }
    
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const template = doc.querySelector(`#${templateId}`);
    
    if (!template) {
      throw new Error(`Template with id '${templateId}' not found in ${templatePath}`);
    }
    
    // Append template to document body
    document.body.appendChild(template);
    
    console.log(`Template '${templateId}' loaded successfully`);
  } catch (error) {
    console.error('Error loading template:', error);
  }
}

// Load all required templates when page loads
async function loadAllTemplates() {
  await Promise.all([
    loadTemplate('templates/recover-result.html', 'recover-result-template'),
    loadTemplate('templates/denovo-result.html', 'denovo-result-template'),
    loadTemplate('templates/msblast-result.html', 'msblast-result-template')
  ]);
}

// Initialize template loading
document.addEventListener('DOMContentLoaded', loadAllTemplates);
