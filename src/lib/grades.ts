// Canonical CMU grade model — single source of truth for both manual entry
// and transcript import so the two can never disagree (see audit F1).

export interface GradeOption {
  value: string;
  label: string;
  /** Quality points per unit, or null when the grade is excluded from the QPA. */
  points: number | null;
}

// Factored grades contribute to the QPA (units count in the denominator).
// Non-factored grades (P, S, N, W, I, AD, O) are excluded per CMU policy.
export const GRADE_OPTIONS: GradeOption[] = [
  { value: "NO_GRADE", label: "No Grade", points: null },
  { value: "A", label: "A", points: 4.0 },
  { value: "B", label: "B", points: 3.0 },
  { value: "C", label: "C", points: 2.0 },
  { value: "D", label: "D", points: 1.0 },
  { value: "R", label: "R (Failing)", points: 0.0 },
  { value: "P", label: "P (Pass)", points: null },
  { value: "S", label: "S (Satisfactory)", points: null },
  { value: "N", label: "N (No Credit)", points: null },
  { value: "I", label: "I (Incomplete)", points: null },
  { value: "W", label: "W (Withdrawn)", points: null },
  { value: "AD", label: "AD (Audit)", points: null },
  { value: "O", label: "O (Auditor)", points: null },
];

const POINTS_BY_GRADE: Record<string, number | null> = Object.fromEntries(
  GRADE_OPTIONS.map((g) => [g.value, g.points])
);

/** Quality points per unit for a grade, or null when excluded from the QPA. */
export function gradePoints(grade: string): number | null {
  return grade in POINTS_BY_GRADE ? POINTS_BY_GRADE[grade] : null;
}

/** True when the grade is a recognized CMU grade (not the empty/placeholder). */
export function isKnownGrade(grade: string): boolean {
  return grade in POINTS_BY_GRADE && grade !== "NO_GRADE";
}

/** Normalize a raw transcript token to a canonical grade value, or "NO_GRADE". */
export function normalizeGrade(raw: string): string {
  const upper = raw.trim().toUpperCase();
  return upper in POINTS_BY_GRADE && upper !== "NO_GRADE" ? upper : "NO_GRADE";
}

export interface QpaTotals {
  qualityPoints: number;
  factorableUnits: number;
  /** null when there are no factorable units (empty / all-excluded). */
  qpa: number | null;
}

export interface CourseLike {
  units: number | string;
  grade: string;
}

/** Aggregate quality points, factorable units, and QPA for a set of courses. */
export function computeTotals(courses: CourseLike[]): QpaTotals {
  let qualityPoints = 0;
  let factorableUnits = 0;

  for (const course of courses) {
    const points = gradePoints(course.grade);
    const units =
      typeof course.units === "string" ? parseFloat(course.units) : course.units;
    if (points !== null && units !== undefined && !isNaN(units)) {
      qualityPoints += units * points;
      factorableUnits += units;
    }
  }

  return {
    qualityPoints,
    factorableUnits,
    qpa:
      factorableUnits === 0
        ? null
        : parseFloat((qualityPoints / factorableUnits).toFixed(2)),
  };
}

export const MAX_UNITS = 999;
