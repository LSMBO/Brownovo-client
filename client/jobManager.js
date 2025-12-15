// Job Manager - Manage running jobs

let currentJobs = [];
let isJobRunning = false;

/**
 * Add a new job to the list
 * @param {string} id - Unique job ID
 * @param {string} type - Job type (upload, recover, denovo, msblast)
 * @param {string} description - Job description
 */
function addJob(id, type, description) {
  const job = {
    id,
    type,
    description,
    startTime: Date.now(),
    status: 'running'
  };
  
  currentJobs.push(job);
  isJobRunning = true;
  updateJobsList();
  return job;
}

function updateJob(id, status, message = '') {
  const job = currentJobs.find(j => j.id === id);
  if (job) {
    job.status = status;
    job.message = message;
    job.endTime = Date.now();
    
    // Update isJobRunning flag based on remaining running jobs
    isJobRunning = currentJobs.some(j => j.status === 'running');
    
    updateJobsList();
  }
}

function removeJob(id) {
  currentJobs = currentJobs.filter(j => j.id !== id);
  
  // Check if there are still running jobs
  isJobRunning = currentJobs.some(j => j.status === 'running');
  
  updateJobsList();
}

function hasRunningJob() {
  return isJobRunning;
}

function warnIfJobRunning() {
  if (hasRunningJob()) {
    alert('⚠️ A job is already running. Please wait for it to complete before starting a new one.');
    return true;
  }
  return false;
}

function updateJobsList() {
  const jobsList = document.getElementById('jobs-list');
  if (!jobsList) return;
  
  jobsList.innerHTML = '';
  
  if (currentJobs.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'empty-jobs-message';
    emptyMsg.textContent = 'No active jobs';
    jobsList.appendChild(emptyMsg);
    return;
  }
  
  currentJobs.forEach(job => {
    const li = document.createElement('li');
    li.className = `job-item job-${job.status}`;
    
    const statusIcon = {
      running: '⏳',
      completed: '✅',
      failed: '❌'
    }[job.status] || '•';
    
    const duration = job.endTime 
      ? `${Math.round((job.endTime - job.startTime) / 1000)}s`
      : `${Math.round((Date.now() - job.startTime) / 1000)}s`;
    
    li.innerHTML = `
      <span class="job-status">${statusIcon}</span>
      <span class="job-description">${job.description}</span>
      <span class="job-duration">${duration}</span>
    `;
    
    // Add remove button for completed jobs
    if (job.status !== 'running') {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'job-remove-btn';
      removeBtn.textContent = '×';
      removeBtn.onclick = () => removeJob(job.id);
      li.appendChild(removeBtn);
    }
    
    jobsList.appendChild(li);
  });
}

// Update duration of running jobs every second
setInterval(() => {
  if (currentJobs.some(j => j.status === 'running')) {
    updateJobsList();
  }
}, 1000);

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    addJob, 
    updateJob, 
    removeJob, 
    hasRunningJob, 
    warnIfJobRunning,
    updateJobsList 
  };
}
