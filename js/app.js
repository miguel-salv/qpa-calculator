import { GRADE_OPTIONS, computeTotals, gradePoints, MAX_UNITS } from './grades.js';

const STORAGE_KEY = 'semesters';

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
  grip:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let semesters = [];

const HISTORY_LIMIT = 50;
let undoStack = [];
let redoStack = [];
let editSessionOpen = false;

function snapshot() {
  return semesters.map((s) => ({
    id: s.id,
    name: s.name,
    collapsed: !!s.collapsed,
    courses: s.courses.map((c) => ({ ...c })),
  }));
}

function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = [];
}

function restore(state) {
  semesters = state.map((s) => ({
    id: s.id,
    name: s.name,
    collapsed: !!s.collapsed,
    courses: s.courses.map((c) => ({ ...c })),
  }));
  save();
  render();
}

function mutate(fn) {
  pushHistory();
  fn();
  save();
  render();
}

function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
}

function newSemester(index) {
  return { id: crypto.randomUUID(), name: `Semester ${index}`, courses: [], collapsed: false };
}


function load() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        semesters = parsed.map((s) => ({
          collapsed: false,
          ...s,
          courses: Array.isArray(s.courses) ? s.courses : [],
        }));
        return;
      }
    }
  } catch (error) {
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

const formatUnits = (units) =>
  Number.isInteger(units) ? String(units) : String(parseFloat(units.toFixed(1)));

function gradeLabel(value) {
  const opt = GRADE_OPTIONS.find((o) => o.value === value);
  return opt ? opt.label : 'No Grade';
}

const listEl = document.getElementById('semester-list');
const scrollArea = document.querySelector('.semester-scroll-area');

function render() {
  listEl.innerHTML = semesters.map(renderSemester).join('');
  document.querySelectorAll('.icon-slot[data-icon]').forEach((el) => {
    if (!el.dataset.filled) {
      el.innerHTML = ICONS[el.dataset.icon] || '';
      el.dataset.filled = '1';
    }
  });
  updateComputedUI();
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

  const collapsed = !!semester.collapsed;
  const bodyId = `semester-body-${sid}`;

  return `
    <div class="card semester-card${collapsed ? ' is-collapsed' : ''}" data-semester-id="${sid}">
      <div class="semester-header">
        <button type="button" class="drag-handle semester-drag-handle"
          data-action="drag-semester" data-semester-id="${sid}"
          aria-label="Reorder ${escapeHtml(semester.name)} (drag, or use arrow keys)">
          <span class="icon-slot">${ICONS.grip}</span>
        </button>
        <button type="button" class="btn btn-ghost btn-sm semester-collapse-button"
          data-action="toggle-collapse" data-semester-id="${sid}"
          aria-expanded="${!collapsed}" aria-controls="${bodyId}"
          aria-label="${collapsed ? 'Expand' : 'Collapse'} ${escapeHtml(semester.name)}">
          <span class="collapse-chevron icon-slot">${ICONS.chevron}</span>
        </button>
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
      <div class="card-content" id="${bodyId}"${collapsed ? ' hidden' : ''}>
        <table class="course-table">
          <caption class="sr-only">Courses for ${escapeHtml(semester.name)}</caption>
          <thead>
            <tr>
              <th scope="col" class="col-grip"><span class="sr-only">Reorder</span></th>
              <th scope="col" class="col-course">Course</th>
              <th scope="col" class="col-units">Units</th>
              <th scope="col" class="col-grade">Grade</th>
              <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
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
  const isNonFactored = (opt) => opt.points === null && opt.value !== 'NO_GRADE';
  const renderOption = (opt) => {
    const hint = opt.hint
      ? ` <span class="grade-hint">${escapeHtml(opt.hint)}</span>`
      : '';
    return `<li class="grade-option grade-nav-item" role="option" id="grade-opt-${cid}-${escapeHtml(opt.value)}"
         data-value="${escapeHtml(opt.value)}"
         aria-selected="${opt.value === course.grade}"><span class="grade-code">${escapeHtml(
      opt.label
    )}</span>${hint}</li>`;
  };
  const factored = GRADE_OPTIONS.filter((opt) => !isNonFactored(opt)).map(renderOption).join('');
  const nonFactored = GRADE_OPTIONS.filter(isNonFactored).map(renderOption).join('');
  const expanded = isNonFactored({ points: gradePoints(course.grade), value: course.grade });
  const options = `${factored}<li class="grade-group" role="presentation">
        <div class="grade-group-toggle grade-nav-item" role="button" tabindex="-1"
          data-action="grade-group-toggle" aria-expanded="${expanded}">
          <span class="grade-toggle-label">No QPA impact</span>
          ${ICONS.chevron}
        </div>
        <ul class="grade-subgroup" role="group" aria-label="Grades with no QPA impact"${
          expanded ? '' : ' hidden'
        }>${nonFactored}</ul>
      </li>`;

  return `
    <tr class="course-row" data-course-id="${cid}" data-semester-id="${sid}">
      <td class="col-grip" data-label="">
        <button type="button" class="drag-handle course-drag-handle"
          data-action="drag-course" data-semester-id="${sid}" data-course-id="${cid}"
          aria-label="Reorder course ${escapeHtml(course.name || 'row')} (drag, or use arrow keys)">
          <span class="icon-slot">${ICONS.grip}</span>
        </button>
      </td>
      <td class="col-course" data-label="Course">
        <input type="text" class="input course-name-input"
          placeholder="e.g. 18-349 Introduction to Embedded Systems"
          value="${escapeHtml(course.name)}" autocomplete="off" spellcheck="false"
          aria-label="Course name (optional)"
          data-action="course-name" data-semester-id="${sid}" data-course-id="${cid}" />
      </td>
      <td class="col-units" data-label="Units">
        <input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off"
          class="input course-units-input tabular-nums" placeholder="e.g. 9"
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
      <td class="col-actions">
        <button type="button" class="btn btn-ghost btn-sm course-delete-button"
          data-action="delete-course" data-semester-id="${sid}" data-course-id="${cid}"
          aria-label="Remove course ${escapeHtml(course.name || 'row')}">
          <span class="icon-slot">${ICONS.trash}</span>
        </button>
      </td>
    </tr>`;
}

function updateComputedUI() {
  for (const semester of semesters) {
    const card = listEl.querySelector(`.semester-card[data-semester-id="${cssId(semester.id)}"]`);
    if (!card) continue;
    const totals = computeTotals(semester.courses);

    const qpaEl = card.querySelector('[data-semester-qpa]');
    if (qpaEl) qpaEl.textContent = formatQpa(totals.qpa);
  }

  const cumulative = computeTotals(semesters.flatMap((s) => s.courses));
  document.getElementById('cumulative-qpa').textContent = formatQpa(cumulative.qpa);
  const unitsEl = document.getElementById('cumulative-units');
  if (unitsEl) {
    unitsEl.textContent =
      cumulative.factorableUnits > 0
        ? `${formatUnits(cumulative.factorableUnits)} units counted`
        : '';
  }
}

function cssId(id) {
  return String(id).replace(/["\\]/g, '\\$&');
}

function findSemester(id) {
  return semesters.find((s) => s.id === id);
}
function findCourse(semesterId, courseId) {
  const s = findSemester(semesterId);
  return s ? s.courses.find((c) => c.id === courseId) : null;
}

function addSemester() {
  mutate(() => {
    semesters.push(newSemester(semesters.length + 1));
  });
}

function removeSemester(id) {
  const index = semesters.findIndex((s) => s.id === id);
  if (index === -1) return;
  const removed = semesters[index];

  mutate(() => {
    semesters.splice(index, 1);
    if (semesters.length === 0) semesters.push(newSemester(1));
  });

  toast({
    title: 'Semester deleted',
    description: removed.name,
    action: { label: 'Undo', onClick: undo },
  });
}

function addCourse(semesterId) {
  const s = findSemester(semesterId);
  if (!s) return;
  mutate(() => {
    s.courses.push({ id: crypto.randomUUID(), name: '', units: '', grade: 'NO_GRADE' });
  });
}

function removeCourse(semesterId, courseId) {
  const s = findSemester(semesterId);
  if (!s) return;
  const index = s.courses.findIndex((c) => c.id === courseId);
  if (index === -1) return;
  const removed = s.courses[index];
  mutate(() => {
    s.courses.splice(index, 1);
  });

  toast({
    title: 'Course deleted',
    description: removed.name || 'Untitled course',
    action: { label: 'Undo', onClick: undo },
  });
}

function toggleCollapse(semesterId) {
  const s = findSemester(semesterId);
  if (!s) return;
  s.collapsed = !s.collapsed;
  save();
  render();
}

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
      removeSemester(sid);
      break;
    case 'toggle-collapse':
      toggleCollapse(sid);
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

// Snapshot once per typing burst so undo reverts the whole edit, not each keystroke
function beginEditSession() {
  if (editSessionOpen) return;
  editSessionOpen = true;
  pushHistory();
}

listEl.addEventListener('input', (e) => {
  const el = e.target;
  const action = el.dataset.action;
  if (action === 'course-name') {
    const c = findCourse(el.dataset.semesterId, el.dataset.courseId);
    if (c) {
      beginEditSession();
      c.name = el.value;
      save();
    }
  } else if (action === 'course-units') {
    const c = findCourse(el.dataset.semesterId, el.dataset.courseId);
    if (!c) return;
    beginEditSession();
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
    if (s) {
      beginEditSession();
      s.name = el.value;
    }
  }
});

listEl.addEventListener(
  'focusout',
  (e) => {
    const action = e.target.dataset && e.target.dataset.action;
    if (action === 'course-name' || action === 'course-units' || action === 'rename-input') {
      editSessionOpen = false;
    }
  },
  true
);

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
    // Expand the group only when the current grade lives inside it.
    const group = box.querySelector('.grade-group');
    if (group) {
      const sub = group.querySelector('.grade-subgroup');
      const toggle = group.querySelector('.grade-group-toggle');
      const selectedInGroup = !!sub.querySelector('[aria-selected="true"]');
      sub.hidden = !selectedInGroup;
      toggle.setAttribute('aria-expanded', String(selectedInGroup));
    }
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
  box.querySelectorAll('.grade-nav-item.active').forEach((o) => o.classList.remove('active'));
  openDropdown = null;
}

function setActiveOption(box, option) {
  if (!option) return;
  box.querySelectorAll('.grade-nav-item.active').forEach((o) => o.classList.remove('active'));
  option.classList.add('active');
  option.scrollIntoView({ block: 'nearest' });
  const trigger = box.closest('.grade-select').querySelector('.course-grade-select');
  if (option.id) trigger.setAttribute('aria-activedescendant', option.id);
  else trigger.removeAttribute('aria-activedescendant');
}

function navItems(box) {
  return Array.from(box.querySelectorAll('.grade-nav-item')).filter(
    (el) => !el.closest('[hidden]')
  );
}

function toggleGradeGroup(toggle) {
  const group = toggle.closest('.grade-group');
  const sub = group.querySelector('.grade-subgroup');
  const nowExpanded = sub.hidden;
  sub.hidden = !nowExpanded;
  toggle.setAttribute('aria-expanded', String(nowExpanded));
  return nowExpanded;
}

function selectGrade(wrapper, value) {
  const c = findCourse(wrapper.dataset.semesterId, wrapper.dataset.courseId);
  if (!c) return;
  if (c.grade !== value) {
    pushHistory();
  }
  c.grade = value;
  save();
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

listEl.addEventListener('click', (e) => {
  const toggle = e.target.closest('.grade-group-toggle');
  if (toggle) {
    const expanded = toggleGradeGroup(toggle);
    if (expanded) {
      const box = toggle.closest('.grade-listbox');
      const firstSub = toggle
        .closest('.grade-group')
        .querySelector('.grade-subgroup .grade-option');
      setActiveOption(box, firstSub);
    } else {
      setActiveOption(toggle.closest('.grade-listbox'), toggle);
    }
    return;
  }
  const opt = e.target.closest('.grade-option');
  if (opt) {
    const wrapper = opt.closest('.grade-select');
    selectGrade(wrapper, opt.dataset.value);
  }
});

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
  const options = navItems(box);
  const current = box.querySelector('.grade-nav-item.active');
  let idx = options.indexOf(current);

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setActiveOption(box, options[Math.min(idx + 1, options.length - 1)]);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setActiveOption(box, options[Math.max(idx - 1, 0)]);
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (!current) return;
    if (current.classList.contains('grade-group-toggle')) {
      const expanded = toggleGradeGroup(current);
      if (expanded) {
        const firstSub = current
          .closest('.grade-group')
          .querySelector('.grade-subgroup .grade-option');
        setActiveOption(box, firstSub || current);
      }
    } else {
      selectGrade(openDropdown, current.dataset.value);
    }
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

function commitSemesterOrder() {
  const ids = Array.from(listEl.querySelectorAll(':scope > .semester-card')).map(
    (el) => el.dataset.semesterId
  );
  const changed = semesters.some((s, i) => s.id !== ids[i]);
  if (changed) {
    pushHistory();
  }
  semesters.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  save();
}

function commitCourseOrder(semesterId, tbody) {
  const s = findSemester(semesterId);
  if (!s) return;
  const ids = Array.from(tbody.querySelectorAll(':scope > .course-row')).map(
    (el) => el.dataset.courseId
  );
  const changed = s.courses.some((c, i) => c.id !== ids[i]);
  if (changed) {
    pushHistory();
  }
  s.courses.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  save();
}

let dragState = null;

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function siblingItems(container, isCourse, exclude) {
  const sel = isCourse ? ':scope > .course-row' : ':scope > .semester-card';
  return Array.from(container.querySelectorAll(sel)).filter((el) => el !== exclude);
}

function syncClonedInputs(src, clone) {
  const s = src.querySelectorAll('input');
  const c = clone.querySelectorAll('input');
  s.forEach((el, i) => {
    if (c[i]) c[i].value = el.value;
  });
}

function buildFloating(item, rect, isCourse) {
  let floating;
  if (isCourse) {
    floating = document.createElement('table');
    floating.className = 'course-table drag-floating drag-float-table';
    const tbody = document.createElement('tbody');
    const clone = item.cloneNode(true);
    const srcCells = item.children;
    const cloneCells = clone.children;
    for (let i = 0; i < srcCells.length; i++) {
      if (cloneCells[i]) {
        cloneCells[i].style.width = srcCells[i].getBoundingClientRect().width + 'px';
      }
    }
    syncClonedInputs(item, clone);
    tbody.appendChild(clone);
    floating.appendChild(tbody);
  } else {
    floating = item.cloneNode(true);
    floating.classList.add('drag-floating');
    syncClonedInputs(item, floating);
  }
  floating.setAttribute('aria-hidden', 'true');
  floating.style.top = rect.top + 'px';
  floating.style.left = rect.left + 'px';
  floating.style.width = rect.width + 'px';
  return floating;
}

function onHandlePointerDown(e) {
  const handle = e.target.closest('.drag-handle');
  if (!handle) return;
  if (e.button !== undefined && e.button !== 0) return;

  const isCourse = handle.dataset.action === 'drag-course';
  const item = handle.closest(isCourse ? '.course-row' : '.semester-card');
  if (!item) return;
  const container = isCourse ? item.parentElement : listEl;

  e.preventDefault();
  handle.setPointerCapture(e.pointerId);

  const reduced = prefersReducedMotion();
  const rect = item.getBoundingClientRect();

  let floating = null;
  if (reduced) {
    item.classList.add('dragging');
  } else {
    floating = buildFloating(item, rect, isCourse);
    document.body.appendChild(floating);
    item.classList.add('drag-origin');
  }

  dragState = {
    handle,
    item,
    container,
    isCourse,
    floating,
    reduced,
    pointerId: e.pointerId,
    grabOffsetY: e.clientY - rect.top,
    left: rect.left,
    lastClientY: e.clientY,
    autoScrollRaf: 0,
    moved: false,
  };
  document.body.classList.add('is-dragging');
  startAutoScroll();

  // Listen on window: reordering moves the handle in the DOM and drops pointer capture
  window.addEventListener('pointermove', onHandlePointerMove);
  window.addEventListener('pointerup', onHandlePointerUp);
  window.addEventListener('pointercancel', onHandlePointerUp);
}

function onHandlePointerMove(e) {
  if (!dragState) return;
  dragState.moved = true;
  dragState.lastClientY = e.clientY;

  if (dragState.floating) {
    dragState.floating.style.top = e.clientY - dragState.grabOffsetY + 'px';
    dragState.floating.style.left = dragState.left + 'px';
  }

  updateInsertion(e.clientY);
}

function updateInsertion(clientY) {
  if (!dragState) return;
  const { item, container, isCourse, reduced } = dragState;

  const siblings = siblingItems(container, isCourse, item);
  let ref = null;
  for (const sib of siblings) {
    const r = sib.getBoundingClientRect();
    if (clientY < r.top + r.height / 2) {
      ref = sib;
      break;
    }
  }

  if (ref === item.nextElementSibling || ref === item) return;

  if (reduced) {
    container.insertBefore(item, ref);
    return;
  }

  // FLIP: measure, reorder, then invert + play so siblings animate
  const first = siblings.map((el) => el.getBoundingClientRect().top);
  container.insertBefore(item, ref);
  siblings.forEach((el, i) => {
    const dy = first[i] - el.getBoundingClientRect().top;
    if (!dy) return;
    el.classList.add('drag-flip');
    el.style.transition = 'none';
    el.style.transform = `translateY(${dy}px)`;
    requestAnimationFrame(() => {
      el.style.transition = '';
      el.style.transform = '';
    });
  });
}

const AUTOSCROLL_EDGE = 48;
const AUTOSCROLL_MAX = 14;

function startAutoScroll() {
  if (!scrollArea) return;
  const step = () => {
    if (!dragState) return;
    const rect = scrollArea.getBoundingClientRect();
    const y = dragState.lastClientY;
    const maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight;
    let delta = 0;

    if (maxScroll > 0) {
      const topGap = y - rect.top;
      const bottomGap = rect.bottom - y;
      if (topGap < AUTOSCROLL_EDGE && scrollArea.scrollTop > 0) {
        const strength = Math.min(1, (AUTOSCROLL_EDGE - topGap) / AUTOSCROLL_EDGE);
        delta = -Math.ceil(strength * AUTOSCROLL_MAX);
      } else if (bottomGap < AUTOSCROLL_EDGE && scrollArea.scrollTop < maxScroll) {
        const strength = Math.min(1, (AUTOSCROLL_EDGE - bottomGap) / AUTOSCROLL_EDGE);
        delta = Math.ceil(strength * AUTOSCROLL_MAX);
      }
    }

    if (delta !== 0) {
      scrollArea.scrollTop += delta;
      updateInsertion(y);
      if (dragState.floating) {
        dragState.floating.style.top = y - dragState.grabOffsetY + 'px';
      }
    }

    dragState.autoScrollRaf = requestAnimationFrame(step);
  };
  dragState.autoScrollRaf = requestAnimationFrame(step);
}

function stopAutoScroll() {
  if (dragState && dragState.autoScrollRaf) {
    cancelAnimationFrame(dragState.autoScrollRaf);
    dragState.autoScrollRaf = 0;
  }
}

function onHandlePointerUp() {
  if (!dragState || dragState.ending) return;
  dragState.ending = true;
  const { handle, item, container, isCourse, floating, moved, reduced } = dragState;
  window.removeEventListener('pointermove', onHandlePointerMove);
  window.removeEventListener('pointerup', onHandlePointerUp);
  window.removeEventListener('pointercancel', onHandlePointerUp);
  stopAutoScroll();
  document.body.classList.remove('is-dragging');

  const finish = () => {
    if (floating) floating.remove();
    item.classList.remove('drag-origin', 'dragging');
    container
      .querySelectorAll('.drag-flip')
      .forEach((el) => el.classList.remove('drag-flip'));
    if (moved) {
      if (isCourse) commitCourseOrder(item.dataset.semesterId, container);
      else commitSemesterOrder();
      updateComputedUI();
    }
    const sel = isCourse
      ? `.course-drag-handle[data-course-id="${cssId(item.dataset.courseId)}"]`
      : `.semester-drag-handle[data-semester-id="${cssId(item.dataset.semesterId)}"]`;
    focusHandle(sel);
    dragState = null;
  };

  if (floating && !reduced) {
    const dest = item.getBoundingClientRect();
    floating.classList.add('settling');
    floating.style.top = dest.top + 'px';
    floating.style.left = dest.left + 'px';
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      finish();
    };
    floating.addEventListener('transitionend', end, { once: true });
    setTimeout(end, 240);
  } else {
    finish();
  }
}

listEl.addEventListener('pointerdown', onHandlePointerDown);

function moveItemInArray(arr, from, to) {
  if (to < 0 || to >= arr.length) return false;
  const [it] = arr.splice(from, 1);
  arr.splice(to, 0, it);
  return true;
}

listEl.addEventListener('keydown', (e) => {
  const handle = e.target.closest('.drag-handle');
  if (!handle) return;
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  const dir = e.key === 'ArrowUp' ? -1 : 1;

  if (handle.dataset.action === 'drag-semester') {
    const idx = semesters.findIndex((s) => s.id === handle.dataset.semesterId);
    if (idx === -1 || !moveItemInArray(semesters, idx, idx + dir)) return;
    save();
    render();
    focusHandle(`.semester-drag-handle[data-semester-id="${cssId(handle.dataset.semesterId)}"]`);
  } else {
    const s = findSemester(handle.dataset.semesterId);
    if (!s) return;
    const idx = s.courses.findIndex((c) => c.id === handle.dataset.courseId);
    if (idx === -1 || !moveItemInArray(s.courses, idx, idx + dir)) return;
    save();
    render();
    focusHandle(`.course-drag-handle[data-course-id="${cssId(handle.dataset.courseId)}"]`);
  }
});

function focusHandle(selector) {
  const el = listEl.querySelector(selector);
  if (el) el.focus();
}

function confirmViaDialog(dialogId, cancelId, confirmId, fallbackMessage) {
  const dlg = document.getElementById(dialogId);
  if (!dlg || typeof dlg.showModal !== 'function') {
    return Promise.resolve(confirm(fallbackMessage));
  }
  return new Promise((resolve) => {
    const cancelBtn = document.getElementById(cancelId);
    const confirmBtn = document.getElementById(confirmId);
    const onCancel = () => finish(false);
    const onConfirm = () => finish(true);
    const onClose = () => finish(false);
    function finish(result) {
      dlg.removeEventListener('close', onClose);
      cancelBtn.removeEventListener('click', onCancel);
      confirmBtn.removeEventListener('click', onConfirm);
      dlg.close();
      resolve(result);
    }
    dlg.addEventListener('close', onClose);
    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
    dlg.showModal();
  });
}

function confirmOverwrite() {
  return confirmViaDialog(
    'import-dialog',
    'import-cancel',
    'import-confirm',
    'Importing replaces your current semesters and courses. Continue?'
  );
}

const toastRegion = document.getElementById('toast-region');

function toast({ title, description, variant, action }) {
  const el = document.createElement('div');
  const destructive = variant === 'destructive';
  el.className = 'toast' + (destructive ? ' destructive' : '');
  el.setAttribute('role', destructive ? 'alert' : 'status');

  const body = document.createElement('div');
  body.className = 'toast-body';
  body.innerHTML = `
    ${title ? `<p class="toast-title">${escapeHtml(title)}</p>` : ''}
    ${description ? `<p class="toast-description">${escapeHtml(description)}</p>` : ''}`;
  el.appendChild(body);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    if (!reduceMotion) {
      el.style.transition = 'opacity 0.2s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 200);
    } else {
      el.remove();
    }
  };

  if (action && typeof action.onClick === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = action.label || 'Undo';
    btn.addEventListener('click', () => {
      action.onClick();
      dismissed = true;
      el.remove();
    });
    el.appendChild(btn);
  }

  toastRegion.appendChild(el);
  setTimeout(dismiss, action ? 8000 : 5000);
}

document.getElementById('add-semester-btn').addEventListener('click', addSemester);

const clearAllBtn = document.getElementById('clear-all-btn');
if (clearAllBtn) {
  clearAllBtn.addEventListener('click', async () => {
    if (!hasExistingCourses() && semesters.length <= 1) return;
    const proceed = await confirmViaDialog(
      'clear-dialog',
      'clear-cancel',
      'clear-confirm',
      'Delete all semesters and courses? You can undo this afterward.'
    );
    if (!proceed) return;
    mutate(() => {
      semesters = [newSemester(1)];
    });
    toast({
      title: 'All cleared',
      description: 'Every semester and course has been removed.',
      action: { label: 'Undo', onClick: undo },
    });
  });
}

const fileInput = document.getElementById('file-input');
const importBtn = document.getElementById('import-btn');
importBtn.addEventListener('click', () => fileInput.click());

function hasExistingCourses() {
  return semesters.some((s) => s.courses.length > 0);
}

function setImporting(isImporting, progressText) {
  importBtn.disabled = isImporting;
  const label = importBtn.childNodes[importBtn.childNodes.length - 1];
  if (label && label.nodeType === Node.TEXT_NODE) {
    if (!isImporting) {
      label.textContent = ' Import from Academic Record';
    } else {
      label.textContent = progressText ? ` ${progressText}` : ' Importing…';
    }
  }
}

fileInput.addEventListener('change', async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

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
      throw new Error('That file isn’t a PDF.');
    }
    const { parseCMUTranscript } = await import('./transcript.js');
    const parsed = await parseCMUTranscript(file, (page, total) => {
      setImporting(true, total > 1 ? `Reading page ${page} of ${total}…` : 'Reading…');
    });
    if (parsed.length === 0) {
      throw new Error('No courses found in that PDF.');
    }
    const newSemesters = parsed.map((sem, i) => ({
      id: crypto.randomUUID(),
      name: sem.name,
      collapsed: i !== parsed.length - 1,
      courses: sem.courses.map((course) => ({
        id: crypto.randomUUID(),
        name: course.name,
        units: course.units,
        grade: course.grade,
      })),
    }));
    if (newSemesters.some((sem) => sem.courses.length === 0)) {
      throw new Error('Some semesters came through empty.');
    }
    mutate(() => {
      semesters = newSemesters;
    });
    const courseCount = newSemesters.reduce((acc, sem) => acc + sem.courses.length, 0);
    const needGrade = newSemesters.reduce(
      (acc, sem) => acc + sem.courses.filter((c) => c.grade === 'NO_GRADE').length,
      0
    );
    const duplicates = newSemesters.reduce((acc, sem) => {
      const seen = new Set();
      let dupes = 0;
      for (const c of sem.courses) {
        const key = c.name.split(':')[0].trim().toLowerCase();
        if (!key) continue;
        if (seen.has(key)) dupes += 1;
        else seen.add(key);
      }
      return acc + dupes;
    }, 0);
    let description = `Loaded ${newSemesters.length} semesters, ${courseCount} courses.`;
    if (needGrade > 0) {
      description += ` ${needGrade} ${
        needGrade === 1 ? 'needs' : 'need'
      } a grade.`;
    }
    if (duplicates > 0) {
      description += ` ${duplicates} possible ${
        duplicates === 1 ? 'duplicate' : 'duplicates'
      } — please review.`;
    }
    toast({
      title: 'Import complete',
      description,
      action: { label: 'Undo', onClick: undo },
    });
  } catch (error) {
    console.error('Error parsing PDF:', error);
    toast({
      title: 'Import failed',
      description:
        error instanceof Error ? error.message : 'Couldn’t read that PDF.',
      variant: 'destructive',
    });
  } finally {
    setImporting(false);
    fileInput.value = '';
  }
});

document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const key = e.key.toLowerCase();
  if (key !== 'z' && key !== 'y') return;

  const el = document.activeElement;
  const inTextField =
    el &&
    el.tagName === 'INPUT' &&
    ['course-name', 'course-units', 'rename-input'].includes(el.dataset.action);
  // In text fields, defer to the browser's native undo
  if (inTextField) return;

  if (key === 'y' || (key === 'z' && e.shiftKey)) {
    e.preventDefault();
    redo();
  } else if (key === 'z') {
    e.preventDefault();
    undo();
  }
});

document.getElementById('copyright').textContent = `Copyright © ${new Date().getFullYear()}`;
load();
render();
