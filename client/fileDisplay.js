function formatFileSize(sizeInBytes) {
  if (!sizeInBytes || sizeInBytes === 0) {
    return "0 Kb";
  }
  
  const sizeInKb = Math.round(sizeInBytes / 1024);
  
  // Ajouter des espaces tous les 3 chiffres
  const formatted = sizeInKb.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  
  return `${formatted} Kb`;
}

function formatFileDisplay(fileName, sizeInBytes) {
  const size = formatFileSize(sizeInBytes);
  return `${fileName} (${size})`;
}

async function getFileSize(file) {
  // Si la taille est déjà définie (fichier serveur)
  if (file.size !== undefined) {
    return file.size;
  }
  
  // Si fichier local, demander au serveur via Electron
  if (!file.isServerFile && file.path) {
    try {
      const stats = await window.electronAPI.getFileStats(file.path);
      return stats.size;
    } catch (error) {
      console.error(`Erreur récupération taille de ${file.name}:`, error);
      return 0;
    }
  }
  
  return 0;
}

// Export pour utilisation dans renderer.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatFileSize, formatFileDisplay, getFileSize };
}
