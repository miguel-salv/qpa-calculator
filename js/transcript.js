import { normalizeGrade } from './grades.js';
import * as pdfjsLib from '../vendor/pdf.mjs';

let isWorkerInitialized = false;

// Configure the PDF.js worker once, on first import
function initWorker() {
  if (!isWorkerInitialized) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      '../vendor/pdf.worker.mjs',
      import.meta.url
    ).href;
    isWorkerInitialized = true;
  }
}

export async function parseCMUTranscript(file) {
  if (!file) throw new Error('No file provided');
  initWorker();
  const data = new Uint8Array(await file.arrayBuffer());

  const pdf = await pdfjsLib.getDocument({ data }).promise;

  const allTextItems = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items
      .map((item) => {
        if ('str' in item) return item.str.trim();
        if (item.items && item.items.length > 0) return item.items[0].str.trim();
        return '';
      })
      .filter(Boolean);
    allTextItems.push(...items);
  }

  const semesters = [];
  const semesterPattern = /^(Fall|Spring|Summer(\s+\d+\/All|\s+\d+))\s+(\d{4})$/i;
  for (let j = 0; j < allTextItems.length; j++) {
    const item = allTextItems[j];
    if (semesterPattern.test(item)) {
      semesters.push({ name: item.trim(), courses: [] });
    }
  }
  if (semesters.length === 0) {
    throw new Error('No semesters found in the transcript');
  }

  for (let i = 0; i < semesters.length; i++) {
    const semesterHeaderIndex = allTextItems.findIndex(
      (item) => item === semesters[i].name
    );
    const nextSemesterHeaderIndex =
      i < semesters.length - 1
        ? allTextItems.findIndex(
            (item, idx) =>
              idx > semesterHeaderIndex && item === semesters[i + 1].name
          )
        : allTextItems.length;

    for (let j = semesterHeaderIndex; j < nextSemesterHeaderIndex; j++) {
      if (j + 3 < allTextItems.length) {
        const potentialCourseNum = allTextItems[j];
        const potentialCourseName = allTextItems[j + 1];
        const potentialUnits = allTextItems[j + 2];
        const potentialGrade = allTextItems[j + 3];
        const courseNumPattern = /^\d{5}$/;
        if (courseNumPattern.test(potentialCourseNum)) {
          const units = parseFloat(potentialUnits);
          if (!isNaN(units) && units > 0) {
            const formattedUnits = Math.floor(units).toString();
            semesters[i].courses.push({
              name: `${potentialCourseNum}: ${potentialCourseName}`,
              units: formattedUnits,
              grade: normalizeGrade(potentialGrade),
            });
            j += 3;
          }
        }
      }
    }
  }

  const filteredSemesters = semesters.filter((s) => s.courses.length > 0);
  if (filteredSemesters.length === 0) {
    throw new Error('No courses found in any semester');
  }

  filteredSemesters.sort((a, b) => {
    const aMatch = a.name.match(
      /(Fall|Spring|Summer(\s+\d+\/All|\s+\d+)?)\s+(\d{4})/i
    );
    const bMatch = b.name.match(
      /(Fall|Spring|Summer(\s+\d+\/All|\s+\d+)?)\s+(\d{4})/i
    );
    if (!aMatch || !bMatch) return 0;
    const aYear = aMatch[3];
    const bYear = bMatch[3];
    if (aYear !== bYear) {
      return parseInt(aYear) - parseInt(bYear);
    }
    const getTermOrder = (term) => {
      if (term.startsWith('spring')) return 0;
      if (term.startsWith('summer')) return 1;
      if (term.startsWith('fall')) return 2;
      return 0;
    };
    return getTermOrder(aMatch[1].toLowerCase()) - getTermOrder(bMatch[1].toLowerCase());
  });

  return filteredSemesters;
}
