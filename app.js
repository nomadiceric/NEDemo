const permitForm = document.getElementById('permitForm');
const permitTableBody = document.querySelector('#permitTable tbody');
const statusChart = document.getElementById('statusChart');

const receivedCount = document.getElementById('receivedCount');
const inReviewCount = document.getElementById('inReviewCount');
const approvedCount = document.getElementById('approvedCount');

const LOCAL_STORAGE_KEY = 'bpaPermits';
const INTERNAL_STATUSES = ['Received', 'Triage', 'In Review', 'Approved', 'Needs Info', 'Rejected'];
const SOURCES = ['Phone Intake', 'Walk-In', 'Internal Entry', 'Public Portal'];

let permits = [];

function nowIso() {
    return new Date().toISOString();
}

function formatDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function sanitize(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function normalizePermit(p) {
    const status = INTERNAL_STATUSES.includes(p.status) ? p.status : 'Received';
    const source = SOURCES.includes(p.source) ? p.source : 'Internal Entry';
    return {
        id: p.id || Math.random().toString(36).substr(2, 9),
        name: p.name || '',
        type: p.type || '',
        priority: p.priority || 'Medium',
        dueDate: p.dueDate || '',
        status,
        source,
        submittedBy: p.submittedBy || '',
        submittedOn: p.submittedOn || nowIso(),
        neighborhood: p.neighborhood || '',
        publicNotes: p.publicNotes || '',
        internalNotes: p.internalNotes || '',
        assignedReviewer: p.assignedReviewer || '',
        lastUpdated: p.lastUpdated || nowIso()
    };
}

function loadPermits() {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) {
        permits = [];
        return;
    }
    try {
        permits = JSON.parse(saved).map(normalizePermit);
    } catch {
        permits = [];
    }
}

function savePermits() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(permits));
}

function showNotification(msg, isError = false) {
    let notif = document.querySelector('.notification');
    if (!notif) {
        notif = document.createElement('div');
        notif.className = 'notification';
        document.body.appendChild(notif);
    }
    notif.textContent = msg;
    notif.classList.add('show');
    notif.style.background = isError ? '#ef4444' : '';
    setTimeout(() => notif.classList.remove('show'), isError ? 3200 : 1800);
}

function touchPermit(permit) {
    permit.lastUpdated = nowIso();
}

function getStatusCounts() {
    return permits.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
    }, {});
}

function updateDashboard() {
    const counts = getStatusCounts();
    receivedCount.textContent = String(counts['Received'] || 0);
    inReviewCount.textContent = String(counts['In Review'] || 0);
    approvedCount.textContent = String(counts['Approved'] || 0);
}

function getActionButtons(permit, idx) {
    const btns = [];
    
    if (permit.status === 'Received') {
        btns.push(`<button class="actions-btn action-triage" data-idx="${idx}">Triage</button>`);
    } else if (permit.status === 'Triage') {
        btns.push(`<button class="actions-btn action-start-review" data-idx="${idx}">Start Review</button>`);
    } else if (permit.status === 'In Review') {
        btns.push(`<button class="actions-btn action-approve" data-idx="${idx}">Approve</button>`);
        btns.push(`<button class="actions-btn action-needs-info" data-idx="${idx}">Request Info</button>`);
    } else if (permit.status === 'Needs Info') {
        btns.push(`<button class="actions-btn action-resume" data-idx="${idx}">Resume Review</button>`);
    }
    
    btns.push(`<button class="actions-btn action-edit-reviewer" data-idx="${idx}">Assign</button>`);
    btns.push(`<button class="actions-btn delete-btn" data-idx="${idx}">Archive</button>`);
    return btns.join('');
}

function renderPermits() {
    permitTableBody.innerHTML = '';
    permits.forEach((p, idx) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${sanitize(p.name)}</td>
            <td>${sanitize(p.type)}</td>
            <td>${sanitize(p.priority)}${p.priority === 'High' ? ' <span class="priority-warning">&#9888;</span>' : ''}</td>
            <td>${sanitize(p.status)}</td>
            <td>${sanitize(p.source)}</td>
            <td>${sanitize(p.submittedBy)}</td>
            <td>${sanitize(formatDate(p.submittedOn))}</td>
            <td>${sanitize(p.assignedReviewer || 'Unassigned')}</td>
            <td>${sanitize(formatDate(p.lastUpdated))}</td>
            <td>${getActionButtons(p, idx)}</td>
        `;
        permitTableBody.appendChild(row);
    });
    updateDashboard();
}

permitForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const source = document.getElementById('source').value;
    const submitBy = document.getElementById('submitBy').value.trim();
    const name = document.getElementById('permitName').value.trim();
    const type = document.getElementById('permitType').value;
    const priority = document.getElementById('priority').value;
    const dueDate = document.getElementById('dueDate').value;
    const assignedReviewer = document.getElementById('assignedReviewer').value.trim();
    const internalNotes = document.getElementById('internalNotes').value.trim();
    
    if (!source || !submitBy || !name || !type || !priority || !dueDate) {
        showNotification('Please complete all required fields.', true);
        return;
    }
    
    const permit = {
        id: Math.random().toString(36).substr(2, 9),
        name,
        type,
        priority,
        dueDate,
        status: 'Received',
        source,
        submittedBy,
        submittedOn: nowIso(),
        neighborhood: '',
        publicNotes: '',
        internalNotes,
        assignedReviewer,
        lastUpdated: nowIso()
    };
    
    permits.push(permit);
    savePermits();
    renderPermits();
    permitForm.reset();
    showNotification('Permit added to queue.');
});

permitTableBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    const idx = Number(btn.getAttribute('data-idx'));
    const permit = permits[idx];
    if (!permit) return;
    
    if (btn.classList.contains('action-triage')) {
        permit.status = 'Triage';
        touchPermit(permit);
        showNotification('Permit moved to Triage.');
    } else if (btn.classList.contains('action-start-review')) {
        permit.status = 'In Review';
        touchPermit(permit);
        showNotification('Permit moved to In Review.');
    } else if (btn.classList.contains('action-approve')) {
        permit.status = 'Approved';
        touchPermit(permit);
        showNotification('Permit approved.');
    } else if (btn.classList.contains('action-needs-info')) {
        permit.status = 'Needs Info';
        touchPermit(permit);
        showNotification('Marked as Needs Info.');
    } else if (btn.classList.contains('action-resume')) {
        permit.status = 'In Review';
        touchPermit(permit);
        showNotification('Resumed review.');
    } else if (btn.classList.contains('action-edit-reviewer')) {
        openReviewerModal(idx, permit);
        return;
    } else if (btn.classList.contains('delete-btn')) {
        if (!confirm(`Archive permit "${permit.name}"?`)) return;
        permits.splice(idx, 1);
        savePermits();
        renderPermits();
        showNotification('Permit archived.');
        return;
    } else {
        return;
    }
    
    savePermits();
    renderPermits();
});

let currentReviewerEditIdx = null;

const modal = document.getElementById('reviewerModal');
const modalPermitName = document.getElementById('modalPermitName');
const modalReviewerSelect = document.getElementById('modalReviewerSelect');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalSaveBtn = document.getElementById('modalSaveBtn');

function openReviewerModal(idx, permit) {
    currentReviewerEditIdx = idx;
    modalPermitName.textContent = `Permit: ${sanitize(permit.name)}`;
    modalReviewerSelect.value = permit.assignedReviewer || '';
    modal.classList.add('show');
}

function closeReviewerModal() {
    modal.classList.remove('show');
    currentReviewerEditIdx = null;
}

modalCloseBtn.addEventListener('click', closeReviewerModal);
modalCancelBtn.addEventListener('click', closeReviewerModal);

modalSaveBtn.addEventListener('click', () => {
    if (currentReviewerEditIdx === null || currentReviewerEditIdx >= permits.length) {
        closeReviewerModal();
        return;
    }
    const reviewer = modalReviewerSelect.value;
    permits[currentReviewerEditIdx].assignedReviewer = reviewer;
    touchPermit(permits[currentReviewerEditIdx]);
    savePermits();
    renderPermits();
    closeReviewerModal();
    showNotification(`Reviewer ${reviewer || 'unassigned'}.`);
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) closeReviewerModal();
});

loadPermits();
savePermits();
renderPermits();
