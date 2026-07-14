// Factored grades contribute to the QPA (units count in the denominator).
// Non-factored grades (P, S, N, W, I, AD, O) are excluded per CMU policy.
export const GRADE_OPTIONS = [
  { value: "NO_GRADE", label: "No Grade", hint: null, points: null },
  { value: "A", label: "A", hint: null, points: 4.0 },
  { value: "B", label: "B", hint: null, points: 3.0 },
  { value: "C", label: "C", hint: null, points: 2.0 },
  { value: "D", label: "D", hint: null, points: 1.0 },
  { value: "R", label: "R", hint: null, points: 0.0 },
  { value: "P", label: "P", hint: "Pass", points: null },
  { value: "S", label: "S", hint: "Satisfactory", points: null },
  { value: "N", label: "N", hint: "Not Passing", points: null },
  { value: "I", label: "I", hint: "Incomplete", points: null },
  { value: "W", label: "W", hint: "Withdrawn", points: null },
  { value: "AD", label: "AD", hint: "Transfer credit", points: null },
  { value: "O", label: "O", hint: "Audit", points: null },
];

const POINTS_BY_GRADE = Object.fromEntries(
  GRADE_OPTIONS.map((g) => [g.value, g.points])
);

export function gradePoints(grade) {
  return grade in POINTS_BY_GRADE ? POINTS_BY_GRADE[grade] : null;
}

export function isKnownGrade(grade) {
  return grade in POINTS_BY_GRADE && grade !== "NO_GRADE";
}

export function normalizeGrade(raw) {
  const upper = raw.trim().toUpperCase();
  return upper in POINTS_BY_GRADE && upper !== "NO_GRADE" ? upper : "NO_GRADE";
}

export function computeTotals(courses) {
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
