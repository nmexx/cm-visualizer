/**
 * Drag-and-drop CSV import — any dragged file triggers a sold-orders import.
 */
import { loadData } from '../sales.js';
import { toast, showLoading } from '../utils.js';

document.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
document.addEventListener('drop', async e => {
  e.preventDefault();
  const files = [...(e.dataTransfer.files || [])];
  if (!files.length) { return; }
  const csvFiles = files.filter(f => f.name.endsWith('.csv'));
  if (!csvFiles.length) { toast('Only CSV files are supported', 'error'); return; }
  showLoading(true);
  let totalInserted = 0, totalSkipped = 0;
  for (const file of csvFiles) {
    const result = await window.mtg.importFilePath(file.path);
    if (result?.error) { toast(result.error, 'error'); }
    else { totalInserted += result?.totalInserted || 0; totalSkipped += result?.totalSkipped || 0; }
  }
  showLoading(false);
  if (totalInserted > 0 || totalSkipped > 0) {
    toast(`Imported ${totalInserted} orders, ${totalSkipped} already existed`);
    loadData();
  }
});
