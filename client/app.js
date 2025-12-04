document.getElementById('start-btn').addEventListener('click', async () => {
  // Ouvre une boîte de dialogue pour choisir un fichier texte
  const result = await window.electronAPI.browseServer(
    type='FASTA',
    title='Choisir un fichier',
    defaultPath='', // Chemin par défaut
    filter=[{ name: 'fasta Files', extensions: ['fasta', 'faa'] }],
    properties=['openFile']
  );
  if (result && result.length > 0) {
    alert('Fichier sélectionné : ' + result[0]);
  } else {
    alert('Aucun fichier sélectionné.');
  }
});