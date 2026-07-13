// Transcript parsing lives in its own module so the heavy `pdfjs-dist` engine
// can be lazy-loaded (dynamic import) only when a user actually imports a PDF,
// instead of on first paint (audit P5).
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf';

// Import workers directly (will be properly handled by webpack)
import PDFWorker from 'pdfjs-dist/build/pdf.worker.min.js';

import { normalizeGrade } from './grades';

interface CourseData {
  name: string;
  units: string;
  grade: string;
}

export interface SemesterData {
  name: string;
  courses: CourseData[];
}

let isWorkerInitialized = false;

async function initPdfLib() {
  if (typeof window === 'undefined' || isWorkerInitialized) return;
  try {
    GlobalWorkerOptions.workerSrc = PDFWorker;
    isWorkerInitialized = true;
  } catch (error) {
    console.error('Failed to initialize PDF.js worker:', error);
    throw new Error('Failed to initialize PDF parser');
  }
}

export async function parseCMUTranscript(file: File): Promise<SemesterData[]> {
  if (!file) throw new Error('No file provided');
  if (process.env.NODE_ENV === 'development') {
    console.log('Starting PDF parse for file:', file.name);
  }
  await initPdfLib();
  const data = new Uint8Array(await file.arrayBuffer());
  try {
    const pdf = await getDocument(data).promise;
    if (process.env.NODE_ENV === 'development') {
      console.log(`PDF loaded successfully. Pages: ${pdf.numPages}`);
    }
    const allTextItems: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = content.items
        .map(item => {
          if ('str' in item) return item.str.trim();
          if (item.items && item.items.length > 0) return item.items[0].str.trim();
          return '';
        })
        .filter(Boolean);
      allTextItems.push(...items);
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('All text items:', allTextItems);
    }
    const semesters: SemesterData[] = [];
    const semesterPattern = /^(Fall|Spring|Summer(\s+\d+\/All|\s+\d+))\s+(\d{4})$/i;
    for (let j = 0; j < allTextItems.length; j++) {
      const item = allTextItems[j];
      if (semesterPattern.test(item)) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Found semester header:', item, 'at index', j);
        }
        semesters.push({
          name: item.trim(),
          courses: []
        });
      }
    }
    if (semesters.length === 0) {
      throw new Error('No semesters found in the transcript');
    }
    for (let i = 0; i < semesters.length; i++) {
      const semesterHeaderIndex = allTextItems.findIndex(item => item === semesters[i].name);
      const nextSemesterHeaderIndex = i < semesters.length - 1
        ? allTextItems.findIndex((item, idx) => idx > semesterHeaderIndex && item === semesters[i + 1].name)
        : allTextItems.length;
      if (process.env.NODE_ENV === 'development') {
        console.log(`Processing semester ${semesters[i].name} from index ${semesterHeaderIndex} to ${nextSemesterHeaderIndex}`);
      }
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
              // Convert units to integer by removing decimals
              const formattedUnits = Math.floor(units).toString();

              const course: CourseData = {
                name: `${potentialCourseNum}: ${potentialCourseName}`,
                units: formattedUnits,
                // Map to the canonical grade model so import and manual entry
                // can never disagree (audit F1). Unknown tokens => NO_GRADE.
                grade: normalizeGrade(potentialGrade),
              };
              semesters[i].courses.push(course);
              j += 3;
            }
          }
        }
      }
    }
    const filteredSemesters = semesters.filter(s => s.courses.length > 0);
    if (filteredSemesters.length === 0) {
      throw new Error('No courses found in any semester');
    }
    filteredSemesters.sort((a, b) => {
      const aMatch = a.name.match(/(Fall|Spring|Summer(\s+\d+\/All|\s+\d+)?)\s+(\d{4})/i);
      const bMatch = b.name.match(/(Fall|Spring|Summer(\s+\d+\/All|\s+\d+)?)\s+(\d{4})/i);
      if (!aMatch || !bMatch) return 0;
      const aYear = aMatch[3];
      const bYear = bMatch[3];
      if (aYear !== bYear) {
        return parseInt(aYear) - parseInt(bYear);
      }
      const aTerm = aMatch[1].toLowerCase();
      const bTerm = bMatch[1].toLowerCase();
      const getTermOrder = (term: string) => {
        if (term.startsWith('spring')) return 0;
        if (term.startsWith('summer')) return 1;
        if (term.startsWith('fall')) return 2;
        return 0;
      };
      return getTermOrder(aTerm) - getTermOrder(bTerm);
    });
    if (process.env.NODE_ENV === 'development') {
      console.log('Final parsed semesters:', filteredSemesters);
    }
    return filteredSemesters;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw error instanceof Error ? error : new Error('Failed to parse PDF file');
  }
}
