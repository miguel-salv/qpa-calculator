// Vanilla app logic — replaces QpaCalculator.tsx, the Radix Select/AlertDialog/
// Toast widgets, and the React state/render loop.

import { GRADE_OPTIONS, computeTotals, gradePoints, MAX_UNITS } from './grades.js';

const STORAGE_KEY = 'semesters';

// ---- Inline SVG icons (replaces lucide-react) ------------------------------
const ICONS = {
  upload:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  plus:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  pencil:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  mail:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  github:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>',
  chevron:
    '<svg class="chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- State -----------------------------------------------------------------
let semesters = [];

function newSemester(index) {
  return { id: crypto.randomUUID(), name: `Semester ${index}`, courses: [] };
}

function load() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        semesters = parsed;
        return;
      }
    }
  } catch (error) {
    // Corrupt/legacy storage must never white-screen the app.
    console.error('Failed to read saved semesters, resetting:', error);
  }
  semesters = [newSemester(1)];
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(semesters));
  } catch (error) {
    console.error('Failed to persist semesters:', error);
  }
}

const formatQpa = (qpa) => (qpa === null ? '—' : qpa.toFixed(2));

function courseQualityPoints(course) {
  const points = gradePoints(course.grade);
  const units = typeof course.units === 'string' ? parseFloat(course.units) : course.units;
  if (points === null || units === undefined || isNaN(units)) return '—';
  return (points * units).toFixed(1);
}

function gradeLabel(value) {
  const opt = GRADE_OPTIONS.find((o) => o.value === value);
  return opt ? opt.label : 'No Grade';
}

// ---- Rendering -------------------------------------------------------------
const listEl = document.getElementById('semester-list');

function render() {
  listEl.innerHTML = semesters.map(renderSemester).join('');
  // Populate static icon slots (buttons, footer) once per render.
  document.querySelectorAll('.icon-slot[data-icon]').forEach((el) => {
    if (!el.dataset.filled) {
      el.innerHTML = ICONS[el.dataset.icon] || '';
      el.dataset.filled = '1';
    }
  });
  updateComputedUI();
  // Dynamically injected inputs don't honor the `autofocus` attribute, so
  // focus the active rename field manually and place the caret at the end.
  const editing = semesters.find((s) => s.isEditing);
  if (editing) {
    const input = listEl.querySelector(
      `.semester-card[data-semester-id="${cssId(editing.id)}"] .semester-name-input`
    );
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
}

function renderSemester(semester, index) {
  const sid = escapeHtml(semester.id);
  const rows = semester.courses.map((c) => renderCourseRow(semester.id, c)).join('');
  const totalsRow =
    semester.courses.length > 0
      ? `<tfoot>
           <tr class="course-total-row">
             <th scope="row" class="col-course">Semester totals</th>
             <td class="col-units tabular-nums" data-total-units></td>
             <td class="col-grade" aria-hidden="true"></td>
             <td class="col-qpts tabular-nums" data-total-qpts></td>
             <td class="col-actions"></td>
           </tr>
         </tfoot>`
      : '';

  const nameBlock = semester.isEditing
    ? `<input type="text" class="input semester-name-input" value="${escapeHtml(
        semester.name
      )}" placeholder="Semester ${index + 1}" aria-label="Semester name"
        data-action="rename-input" data-semester-id="${sid}" autofocus />`
    : `<div class="semester-name-row">
         <h2 class="semester-name">${escapeHtml(semester.name)}</h2>
         <button type="button" class="btn btn-ghost btn-sm semester-edit-button"
           data-action="edit-name" data-semester-id="${sid}"
           aria-label="Rename ${escapeHtml(semester.name)}">
           <span class="semester-edit-icon icon-slot">${ICONS.pencil}</span>
         </button>
       </div>`;

  return `
    <div class="card semester-card" data-semester-id="${sid}">
      <div class="semester-header">
        <div class="semester-header-content">
          ${nameBlock}
          <div class="semester-gpa-container">
            <span class="semester-gpa-label">Semester QPA:</span>
            <span class="semester-gpa-value tabular-nums" data-semester-qpa>—</span>
          </div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm semester-delete-button"
          data-action="delete-semester" data-semester-id="${sid}"
          aria-label="Delete ${escapeHtml(semester.name)}">
          <span class="icon-slot">${ICONS.trash}</span>
        </button>
      </div>
      <div class="card-content">
        <table class="course-table">
          <caption class="sr-only">Courses for ${escapeHtml(semester.name)}</caption>
          <thead>
            <tr>
              <th scope="col" class="col-course">Course</th>
              <th scope="col" class="col-units">Units</th>
              <th scope="col" class="col-grade">Grade</th>
              <th scope="col" class="col-qpts">Quality Pts</th>
              <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          ${totalsRow}
        </table>
        <button type="button" class="btn btn-secondary btn-sm add-course-button"
          data-action="add-course" data-semester-id="${sid}">
          <span class="icon-slot">${ICONS.plus}</span>
          Add Course
        </button>
      </div>
    </div>`;
}

function renderCourseRow(semesterId, course) {
  const sid = escapeHtml(semesterId);
  const cid = escapeHtml(course.id);
  const missing = course.grade === 'NO_GRADE';
  const options = GRADE_OPTIONS.map(
    (opt) =>
      `<li class="grade-option" role="option" id="grade-opt-${cid}-${escapeHtml(opt.value)}"
         data-value="${escapeHtml(opt.value)}"
         aria-selected="${opt.value === course.grade}">${escapeHtml(opt.label)}</li>`
  ).join('');

  return `
    <tr class="course-row" data-course-id="${cid}">
      <td class="col-course" data-label="Course">
        <input type="text" class="input course-name-input"
          placeholder="e.g. 15-122 Principles of Imperative Computation…"
          value="${escapeHtml(course.name)}" autocomplete="off" spellcheck="false"
          aria-label="Course name (optional)"
          data-action="course-name" data-semester-id="${sid}" data-course-id="${cid}" />
      </td>
      <td class="col-units" data-label="Units">
        <input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off"
          class="input course-units-input tabular-nums" placeholder="e.g. 9…"
          value="${course.units === '' ? '' : escapeHtml(String(course.units))}"
          aria-label="Units"
          data-action="course-units" data-semester-id="${sid}" data-course-id="${cid}" />
      </td>
      <td class="col-grade" data-label="Grade">
        <div class="grade-select" data-semester-id="${sid}" data-course-id="${cid}">
          <button type="button" class="course-grade-select${missing ? ' no-grade-text' : ''}"
            aria-haspopup="listbox" aria-expanded="false" aria-label="Grade"
            data-action="grade-toggle">
            <span class="grade-value">${escapeHtml(gradeLabel(course.grade))}</span>
            ${ICONS.chevron}
          </button>
          <ul class="grade-listbox" role="listbox" hidden>${options}</ul>
        </div>
      </td>
      <td class="col-qpts tabular-nums" data-label="Quality Pts" data-course-qpts>—</td>
      <td class="col-actions">
        <button type="button" class="btn btn-ghost btn-sm course-delete-button"
          data-action="delete-course" data-semester-id="${sid}" data-course-id="${cid}"
          aria-label="Remove course ${escapeHtml(course.name || 'row')}">
          <span class="icon-slot">${ICONS.trash}</span>
        </button>
      </td>
    </tr>`;
}

// Update all computed QPA figures in place (no DOM rebuild → no focus loss).
function updateComputedUI() {
  for (const semester of semesters) {
    const card = listEl.querySelector(`.semester-card[data-semester-id="${cssId(semester.id)}"]`);
    if (!card) continue;
    const totals = computeTotals(semester.courses);

    const qpaEl = card.querySelector('[data-semester-qpa]');
    if (qpaEl) qpaEl.textContent = formatQpa(totals.qpa);

    const tUnits = card.querySelector('[data-total-units]');
    if (tUnits) tUnits.textContent = totals.factorableUnits;
    const tQpts = card.querySelector('[data-total-qpts]');
    if (tQpts) tQpts.textContent = totals.qualityPoints.toFixed(1);

    for (const course of semester.courses) {
      const row = card.querySelector(`.course-row[data-course-id="${cssId(course.id)}"]`);
      if (!row) continue;
      const cell = row.querySelector('[data-course-qpts]');
      if (cell) cell.textContent = courseQualityPoints(course);
    }
  }

  const cumulative = computeTotals(semesters.flatMap((s) => s.courses));
  document.getElementById('cumulative-qpa').textContent = formatQpa(cumulative.qpa);
  document.getElementById('cumulative-subtotal').textContent =
    `${cumulative.factorableUnits} factorable units · ${cumulative.qualityPoints.toFixed(1)} quality points`;
}

// crypto.randomUUID() output is CSS-selector safe, but guard just in case.
function cssId(id) {
  return String(id).replace(/["\\]/g, '\\$&');
}

// ---- State mutations -------------------------------------------------------
function findSemester(id) {
  return semesters.find((s) => s.id === id);
}
function findCourse(semesterId, courseId) {
  const s = findSemester(semesterId);
  return s ? s.courses.find((c) => c.id === courseId) : null;
}

function addSemester() {
  semesters.push(newSemester(semesters.length + 1));
  save();
  render();
}

function removeSemester(id) {
  semesters = semesters.filter((s) => s.id !== id);
  if (semesters.length === 0) semesters = [newSemester(1)];
  save();
  render();
}

function addCourse(semesterId) {
  const s = findSemester(semesterId);
  if (!s) return;
  s.courses.push({ id: crypto.randomUUID(), name: '', units: '', grade: 'NO_GRADE' });
  save();
  render();
}

function removeCourse(semesterId, courseId) {
  const s = findSemester(semesterId);
  if (!s) return;
  s.courses = s.courses.filter((c) => c.id !== courseId);
  save();
  render();
}

// ---- Event delegation ------------------------------------------------------
listEl.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const sid = el.dataset.semesterId;
  const cid = el.dataset.courseId;

  switch (action) {
    case 'add-course':
      addCourse(sid);
      break;
    case 'delete-course':
      removeCourse(sid, cid);
      break;
    case 'delete-semester':
      openDeleteDialog(sid);
      break;
    case 'edit-name': {
      const s = findSemester(sid);
      if (s) {
        s.isEditing = true;
        render();
      }
      break;
    }
    case 'grade-toggle':
      toggleDropdown(el.closest('.grade-select'));
      break;
    default:
      break;
  }
});

// Live text/number inputs — update state WITHOUT re-render to keep focus.
listEl.addEventListener('input', (e) => {
  const el = e.target;
  const action = el.dataset.action;
  if (action === 'course-name') {
    const c = findCourse(el.dataset.semesterId, el.dataset.courseId);
    if (c) {
      c.name = el.value;
      save();
    }
  } else if (action === 'course-units') {
    const c = findCourse(el.dataset.semesterId, el.dataset.courseId);
    if (!c) return;
    // CMU units are whole numbers; keep digits only and clamp.
    const digits = el.value.replace(/[^0-9]/g, '');
    if (digits === '') {
      c.units = '';
      el.value = '';
    } else {
      const clamped = Math.min(parseInt(digits, 10), MAX_UNITS);
      c.units = clamped;
      el.value = String(clamped);
    }
    save();
    updateComputedUI();
  } else if (action === 'rename-input') {
    const s = findSemester(el.dataset.semesterId);
    if (s) s.name = el.value;
  }
});

// Commit semester rename on blur / Enter.
listEl.addEventListener(
  'blur',
  (e) => {
    if (e.target.dataset && e.target.dataset.action === 'rename-input') {
      commitRename(e.target);
    }
  },
  true
);
listEl.addEventListener('keydown', (e) => {
  if (e.target.dataset && e.target.dataset.action === 'rename-input' && e.key === 'Enter') {
    e.preventDefault();
    e.target.blur();
  }
});

function commitRename(input) {
  const s = findSemester(input.dataset.semesterId);
  if (!s) return;
  const idx = semesters.indexOf(s);
  s.name = input.value.trim() || `Semester ${idx + 1}`;
  s.isEditing = false;
  save();
  render();
}

// ---- Custom dropdown -------------------------------------------------------
let openDropdown = null;

function toggleDropdown(wrapper) {
  if (openDropdown === wrapper) {
    closeDropdown();
  } else {
    closeDropdown();
    openDropdown = wrapper;
    const box = wrapper.querySelector('.grade-listbox');
    const trigger = wrapper.querySelector('.course-grade-select');
    box.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    const selected = box.querySelector('[aria-selected="true"]') || box.firstElementChild;
    setActiveOption(box, selected);
  }
}

function closeDropdown() {
  if (!openDropdown) return;
  const box = openDropdown.querySelector('.grade-listbox');
  const trigger = openDropdown.querySelector('.course-grade-select');
  box.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  trigger.removeAttribute('aria-activedescendant');
  box.querySelectorAll('.grade-option.active').forEach((o) => o.classList.remove('active'));
  openDropdown = null;
}

function setActiveOption(box, option) {
  if (!option) return;
  box.querySelectorAll('.grade-option.active').forEach((o) => o.classList.remove('active'));
  option.classList.add('active');
  option.scrollIntoView({ block: 'nearest' });
  const trigger = box.closest('.grade-select').querySelector('.course-grade-select');
  if (option.id) trigger.setAttribute('aria-activedescendant', option.id);
}

function selectGrade(wrapper, value) {
  const c = findCourse(wrapper.dataset.semesterId, wrapper.dataset.courseId);
  if (!c) return;
  c.grade = value;
  save();
  // Update trigger label + styling and options in place.
  const trigger = wrapper.querySelector('.course-grade-select');
  trigger.querySelector('.grade-value').textContent = gradeLabel(value);
  trigger.classList.toggle('no-grade-text', value === 'NO_GRADE');
  wrapper.querySelectorAll('.grade-option').forEach((o) => {
    o.setAttribute('aria-selected', o.dataset.value === value);
  });
  updateComputedUI();
  closeDropdown();
  trigger.focus();
}

// Option click
listEl.addEventListener('click', (e) => {
  const opt = e.target.closest('.grade-option');
  if (opt) {
    const wrapper = opt.closest('.grade-select');
    selectGrade(wrapper, opt.dataset.value);
  }
});

// Keyboard nav within dropdown / open on key
listEl.addEventListener('keydown', (e) => {
  const trigger = e.target.closest('.course-grade-select');
  if (trigger && !openDropdown) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      toggleDropdown(trigger.closest('.grade-select'));
    }
    return;
  }
  if (!openDropdown) return;
  const box = openDropdown.querySelector('.grade-listbox');
  const options = Array.from(box.querySelectorAll('.grade-option'));
  const current = box.querySelector('.grade-option.active');
  let idx = options.indexOf(current);

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setActiveOption(box, options[Math.min(idx + 1, options.length - 1)]);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setActiveOption(box, options[Math.max(idx - 1, 0)]);
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (current) selectGrade(openDropdown, current.dataset.value);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    const trig = openDropdown.querySelector('.course-grade-select');
    closeDropdown();
    trig.focus();
  }
});

document.addEventListener('click', (e) => {
  if (openDropdown && !e.target.closest('.grade-select')) closeDropdown();
});

// ---- Delete confirmation dialog -------------------------------------------
const dialog = document.getElementById('confirm-dialog');
const dialogTitle = document.getElementById('dialog-title');
let pendingDeleteId = null;

function openDeleteDialog(semesterId) {
  const s = findSemester(semesterId);
  if (!s) return;
  pendingDeleteId = semesterId;
  dialogTitle.textContent = `Delete ${s.name}?`;
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    // Fallback for very old browsers.
    if (confirm(`Delete ${s.name}? This cannot be undone.`)) removeSemester(semesterId);
  }
}

document.getElementById('dialog-cancel').addEventListener('click', () => {
  pendingDeleteId = null;
  dialog.close();
});
document.getElementById('dialog-confirm').addEventListener('click', () => {
  if (pendingDeleteId) removeSemester(pendingDeleteId);
  pendingDeleteId = null;
  dialog.close();
});

// ---- Import overwrite confirmation -----------------------------------------
const importDialog = document.getElementById('import-dialog');

function confirmOverwrite() {
  if (typeof importDialog.showModal !== 'function') {
    return Promise.resolve(
      confirm('Importing replaces your current semesters and courses. Continue?')
    );
  }
  return new Promise((resolve) => {
    const onCancel = () => finish(false);
    const onConfirm = () => finish(true);
    function finish(result) {
      importDialog.removeEventListener('close', onClose);
      document.getElementById('import-cancel').removeEventListener('click', onCancel);
      document.getElementById('import-confirm').removeEventListener('click', onConfirm);
      importDialog.close();
      resolve(result);
    }
    // Esc key / backdrop dismissal counts as cancel.
    const onClose = () => finish(false);
    importDialog.addEventListener('close', onClose);
    document.getElementById('import-cancel').addEventListener('click', onCancel);
    document.getElementById('import-confirm').addEventListener('click', onConfirm);
    importDialog.showModal();
  });
}

// ---- Toasts ----------------------------------------------------------------
const toastRegion = document.getElementById('toast-region');

function toast({ title, description, variant }) {
  const el = document.createElement('div');
  const destructive = variant === 'destructive';
  el.className = 'toast' + (destructive ? ' destructive' : '');
  el.setAttribute('role', destructive ? 'alert' : 'status');
  el.innerHTML = `
    ${title ? `<p class="toast-title">${escapeHtml(title)}</p>` : ''}
    ${description ? `<p class="toast-description">${escapeHtml(description)}</p>` : ''}`;
  toastRegion.appendChild(el);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => {
    if (!reduceMotion) {
      el.style.transition = 'opacity 0.2s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 200);
    } else {
      el.remove();
    }
  }, 5000);
}

// ---- Toolbar actions -------------------------------------------------------
document.getElementById('add-semester-btn').addEventListener('click', addSemester);

const fileInput = document.getElementById('file-input');
const importBtn = document.getElementById('import-btn');
importBtn.addEventListener('click', () => fileInput.click());

function hasExistingCourses() {
  return semesters.some((s) => s.courses.length > 0);
}

function setImporting(isImporting) {
  importBtn.disabled = isImporting;
  const label = importBtn.childNodes[importBtn.childNodes.length - 1];
  // Update the trailing text node label without wiping the icon.
  if (label && label.nodeType === Node.TEXT_NODE) {
    label.textContent = isImporting ? ' Importing…' : ' Import from Academic Record';
  }
}

fileInput.addEventListener('change', async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  // Guard against silently wiping manually entered data.
  if (hasExistingCourses()) {
    const proceed = await confirmOverwrite();
    if (!proceed) {
      fileInput.value = '';
      return;
    }
  }

  setImporting(true);
  try {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('That file isn’t a PDF. Choose your CMU academic record PDF and try again.');
    }
    // Lazy-load the transcript parser only when a PDF is actually imported.
    const { parseCMUTranscript } = await import('./transcript.js');
    const parsed = await parseCMUTranscript(file);
    if (parsed.length === 0) {
      throw new Error(
        'No courses found in that PDF. Export your academic record from SIO and import that file.'
      );
    }
    const newSemesters = parsed.map((sem) => ({
      id: crypto.randomUUID(),
      name: sem.name,
      courses: sem.courses.map((course) => ({
        id: crypto.randomUUID(),
        name: course.name,
        units: course.units,
        grade: course.grade,
      })),
    }));
    if (newSemesters.some((sem) => sem.courses.length === 0)) {
      throw new Error(
        'One or more semesters came through empty. Re-export the academic record and try again.'
      );
    }
    semesters = newSemesters;
    save();
    render();
    const courseCount = newSemesters.reduce((acc, sem) => acc + sem.courses.length, 0);
    toast({
      title: 'Import complete',
      description: `Loaded ${newSemesters.length} semesters and ${courseCount} courses from your academic record.`,
    });
  } catch (error) {
    console.error('Error parsing PDF:', error);
    toast({
      title: 'Import failed',
      description:
        error instanceof Error
          ? error.message
          : 'Couldn’t read that academic record. Check the file and try again.',
      variant: 'destructive',
    });
  } finally {
    setImporting(false);
    fileInput.value = '';
  }
});

// ---- Boot ------------------------------------------------------------------
document.getElementById('copyright').textContent = `Copyright © ${new Date().getFullYear()}`;
load();
render();
