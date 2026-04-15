let allStudents = [];
let charts = {};

function switchTab(tabId) {
  const views = document.querySelectorAll('.view-content');
  const buttons = document.querySelectorAll('.tab-btn');
  
  views.forEach(v => v.classList.remove('active'));
  buttons.forEach(b => b.classList.remove('active'));
  
  const targetView = document.getElementById(`view-${tabId}`);
  if (targetView) targetView.classList.add('active');
  
  const targetBtn = document.getElementById(`tab-${tabId}`);
  if (targetBtn) targetBtn.classList.add('active');
  
  if (tabId === 'analytics') updateCharts();
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function onFileSelected(input) {
  const text = document.getElementById('file-drop-text');
  if (text) {
    text.textContent = input.files[0] ? `📄 ${input.files[0].name}` : 'Click to Upload CSV';
  }
}

async function addStudent() {
  const fields = ['name', 'student_id', 'email', 'department', 'major', 'gpa', 'phone', 'year'];
  const data = {};
  
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) data[id] = el.value.trim();
  });

  if (!data.name) return showToast('Name required', 'error');

  try {
    const res = await fetch('/add-student', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(data) 
    });
    
    if (res.ok) {
        showToast('Student enrolled successfully.');
        // Clear all fields
        fields.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = (id === 'year') ? 'Freshman' : '';
        });
        getStudents();
    } else {
        showToast('Server rejected registration', 'error');
    }
  } catch (err) { showToast('Sync failed', 'error'); }
}

async function uploadCSV() {
  const fileInput = document.getElementById('file');
  if (!fileInput || !fileInput.files[0]) return showToast('No CSV selected', 'error');
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  try {
    const res = await fetch('/upload-csv', { method: 'POST', body: formData });
    if (res.ok) {
        showToast('Database Synchronized.');
        getStudents();
    } else {
        showToast('Upload failed', 'error');
    }
  } catch (err) { showToast('Network error during upload', 'error'); }
}

async function getStudents() {
  try {
    const res = await fetch('/students');
    allStudents = await res.json();
    renderTable(allStudents);
    updateCharts();
  } catch (err) { console.error('Fetch failed', err); }
}

async function searchStudent() {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;
  const name = searchInput.value.trim();
  if (!name) return getStudents();
  try {
    const res = await fetch(`/search?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    renderTable(data);
  } catch (err) { showToast('Query failed', 'error'); }
}

function renderTable(data) {
  const section = document.getElementById('results-section');
  const thead = document.getElementById('table-head');
  const tbody = document.getElementById('table-body');
  const statTotal = document.getElementById('stat-total');
  const statSearch = document.getElementById('stat-search-results');
  const countLabel = document.getElementById('results-count');
  
  if (!section || !thead || !tbody) return;

  section.style.display = 'block';
  if (statTotal) statTotal.textContent = allStudents.length;
  if (statSearch) statSearch.textContent = data.length;
  if (countLabel) countLabel.textContent = `${data.length} Records`;

  // Clear previous content safely
  thead.textContent = '';
  tbody.textContent = '';

  if (data.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 100;
    cell.style.textAlign = 'center';
    cell.style.padding = '2rem';
    cell.textContent = 'Zero matches found.';
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  const keys = Object.keys(data[0]);
  const headerRow = document.createElement('tr');
  keys.forEach(key => {
    const th = document.createElement('th');
    th.textContent = key.replace('_', ' ');
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  data.forEach(student => {
    const row = document.createElement('tr');
    keys.forEach(key => {
      const td = document.createElement('td');
      td.textContent = student[key] ?? '—';
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });
}

function updateCharts() {
  if (allStudents.length === 0) return;

  // GPA Chart
  const gpaData = allStudents.map(s => parseFloat(s.gpa)).filter(g => !isNaN(g));
  if (document.getElementById('chart-gpa')) {
      renderChart('chart-gpa', 'bar', {
        labels: ['< 2.0', '2.0-3.0', '3.0-3.5', '3.5-4.0'],
        datasets: [{
          label: 'Students',
          data: [
            gpaData.filter(g => g < 2).length,
            gpaData.filter(g => g >= 2 && g < 3).length,
            gpaData.filter(g => g >= 3 && g < 3.5).length,
            gpaData.filter(g => g >= 3.5).length
          ],
          backgroundColor: '#f4c430'
        }]
      });
  }

  // Dept Chart
  const depts = [...new Set(allStudents.map(s => s.department).filter(d => d))];
  if (document.getElementById('chart-dept')) {
      renderChart('chart-dept', 'doughnut', {
        labels: depts,
        datasets: [{
          data: depts.map(d => allStudents.filter(s => s.department === d).length),
          backgroundColor: ['#f4c430', '#c8b87a', '#8c7d45', '#4a4020', '#b09c68']
        }]
      });
  }

  // Year Chart
  const years = ['Freshman', 'Sophomore', 'Junior', 'Senior'];
  if (document.getElementById('chart-year')) {
      renderChart('chart-year', 'polarArea', {
        labels: years,
        datasets: [{
          data: years.map(y => allStudents.filter(s => s.year === y).length),
          backgroundColor: ['rgba(244, 196, 48, 0.6)', 'rgba(200, 184, 122, 0.6)', 'rgba(140, 125, 69, 0.6)', 'rgba(74, 64, 32, 0.6)']
        }]
      });
  }
}

function renderChart(id, type, data) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (charts[id]) charts[id].destroy();
  const ctx = canvas.getContext('2d');
  charts[id] = new Chart(ctx, {
    type: type,
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { labels: { color: '#f0e6c8', font: { family: 'Inter' } } }
      },
      scales: type === 'bar' ? {
        y: { ticks: { color: '#8c7d45' }, grid: { color: 'rgba(244,196,48,0.1)' } },
        x: { ticks: { color: '#8c7d45' }, grid: { display : false } }
      } : {}
    }
  });
}

// Attach event listeners and Init
window.addEventListener('DOMContentLoaded', () => {
    // Initial data fetch
    getStudents();
    
    // Tab switching
    document.getElementById('tab-manage')?.addEventListener('click', () => switchTab('manage'));
    document.getElementById('tab-analytics')?.addEventListener('click', () => switchTab('analytics'));
    
    // Registration
    document.getElementById('add-btn')?.addEventListener('click', addStudent);
    
    // File upload
    const fileInput = document.getElementById('file');
    const dropZone = document.getElementById('file-drop-zone');
    
    dropZone?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => onFileSelected(e.target));
    document.getElementById('sync-btn')?.addEventListener('click', uploadCSV);
    
    // Search
    document.getElementById('search-btn')?.addEventListener('click', searchStudent);
    document.getElementById('reset-btn')?.addEventListener('click', () => {
        const input = document.getElementById('search-input');
        if (input) input.value = '';
        getStudents();
    });
    document.getElementById('search-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchStudent();
    });
});
