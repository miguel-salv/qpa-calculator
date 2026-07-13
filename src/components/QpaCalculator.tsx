"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash, Upload, Plus, Pencil } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  GRADE_OPTIONS, computeTotals, gradePoints, MAX_UNITS,
} from "@/lib/grades";
import '@/styles/components/qpa-calculator.css';

interface Course {
  id: string;
  name: string;
  units: number | string;
  grade: string;
}

interface Semester {
  id: string;
  name: string;
  courses: Course[];
  isEditing?: boolean;
}

const formatQpa = (qpa: number | null): string =>
  qpa === null ? "—" : qpa.toFixed(2);

const QpaCalculator = () => {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const storedSemesters = localStorage.getItem('semesters');
      if (storedSemesters) {
        const parsed = JSON.parse(storedSemesters);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSemesters(parsed);
          setHydrated(true);
          return;
        }
      }
    } catch (error) {
      // Corrupt/legacy storage must never white-screen the app (audit F4).
      console.error('Failed to read saved semesters, resetting:', error);
    }
    setSemesters([{ id: crypto.randomUUID(), name: `Semester 1`, courses: [] }]);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem('semesters', JSON.stringify(semesters));
    } catch (error) {
      console.error('Failed to persist semesters:', error);
    }
  }, [semesters, hydrated]);

  const cumulative = useMemo(
    () => computeTotals(semesters.flatMap((s) => s.courses)),
    [semesters]
  );

  const addSemester = () => {
    setSemesters(prev => [
      ...prev,
      { id: crypto.randomUUID(), name: `Semester ${prev.length + 1}`, courses: [] },
    ]);
  };

  const removeSemester = (id: string) => {
    setSemesters(prev => {
      const updated = prev.filter(s => s.id !== id);
      return updated.length === 0
        ? [{ id: crypto.randomUUID(), name: 'Semester 1', courses: [] }]
        : updated;
    });
  };

  const addCourse = (semesterId: string) => {
    setSemesters(prev =>
      prev.map(s =>
        s.id === semesterId
          ? {
            ...s,
            courses: [
              ...s.courses,
              { id: crypto.randomUUID(), name: '', units: '', grade: 'NO_GRADE' },
            ],
          }
          : s
      )
    );
  };

  const removeCourse = (semesterId: string, courseId: string) => {
    setSemesters(prev =>
      prev.map(s =>
        s.id === semesterId
          ? { ...s, courses: s.courses.filter(c => c.id !== courseId) }
          : s
      )
    );
  };

  const updateCourse = (semesterId: string, courseId: string, field: string, value: string | number) => {
    setSemesters(prev =>
      prev.map(s =>
        s.id === semesterId
          ? {
            ...s,
            courses: s.courses.map(c =>
              c.id === courseId ? { ...c, [field]: value } : c
            ),
          }
          : s
      )
    );
  };

  const updateSemesterName = (semesterId: string, newName: string) => {
    setSemesters(prev =>
      prev.map((s, idx) =>
        s.id === semesterId
          ? { ...s, name: newName || `Semester ${idx + 1}`, isEditing: false }
          : s
      )
    );
  };

  const toggleSemesterEdit = (semesterId: string) => {
    setSemesters(prev =>
      prev.map(s =>
        s.id === semesterId ? { ...s, isEditing: !s.isEditing } : s
      )
    );
  };

  const handleUnitsChange = (semesterId: string, courseId: string, rawValue: string) => {
    // CMU units are whole numbers; keep digits only and clamp to a sane bound.
    const digits = rawValue.replace(/[^0-9]/g, '');
    if (digits === '') {
      updateCourse(semesterId, courseId, 'units', '');
      return;
    }
    const clamped = Math.min(parseInt(digits, 10), MAX_UNITS);
    updateCourse(semesterId, courseId, 'units', clamped);
  };

  const courseQualityPoints = (course: Course): string => {
    const points = gradePoints(course.grade);
    const units = typeof course.units === 'string' ? parseFloat(course.units) : course.units;
    if (points === null || units === undefined || isNaN(units)) return '—';
    return (points * units).toFixed(1);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('Please upload a PDF file');
      }
      // Lazy-load the heavy pdfjs engine only on demand (audit P5).
      const { parseCMUTranscript } = await import('@/lib/transcript');
      const parsedSemesters = await parseCMUTranscript(file);
      if (parsedSemesters.length === 0) {
        throw new Error('No semester data found. Please make sure this is a CMU academic record PDF.');
      }
      const newSemesters = parsedSemesters.map(sem => ({
        id: crypto.randomUUID(),
        name: sem.name,
        courses: sem.courses.map(course => ({
          id: crypto.randomUUID(),
          name: course.name,
          units: course.units,
          grade: course.grade,
        })),
      }));
      if (newSemesters.some(sem => sem.courses.length === 0)) {
        throw new Error('Some semesters have no courses. Please make sure the PDF is properly formatted.');
      }
      setSemesters(newSemesters);
      toast({
        title: "Success",
        description: `Imported ${newSemesters.length} semesters with ${newSemesters.reduce((acc, sem) => acc + sem.courses.length, 0)} courses from your academic record.`,
      });
    } catch (error) {
      console.error('Error parsing PDF:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to parse the academic record. Please make sure you uploaded a valid CMU academic record PDF.",
        variant: "destructive",
      });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="qpa-container">
      <div className="qpa-intro">
        <p className="qpa-intro-text">
          Enter your courses and grades to calculate your Quality Point Average.
          All data processing happens locally in your browser — your academic
          records are never sent to any server.
        </p>
        <p className="qpa-formula-note">
          QPA = total quality points ÷ total factorable units, where quality
          points = units × grade value (A=4, B=3, C=2, D=1, R=0). Pass/No-Grade,
          W, I, and audit grades are excluded.
        </p>
      </div>

      <div className="qpa-actions">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          className="file-input-hidden"
          ref={fileInputRef}
          aria-label="Import CMU academic record PDF"
        />
        <Button className="import-button" onClick={() => fileInputRef.current?.click()}>
          <Upload className="button-icon" aria-hidden="true" />
          Import from Academic Record
        </Button>
        <Button className="add-semester-button" variant="outline" onClick={addSemester}>
          <Plus className="button-icon" aria-hidden="true" />
          Add Semester Manually
        </Button>
      </div>

      <ScrollArea className="semester-scroll-area">
        <div className="semester-list">
          {semesters.map((semester, index) => {
            const totals = computeTotals(semester.courses);
            return (
              <Card key={semester.id} className="semester-card">
                <CardHeader className="semester-header">
                  <div className="semester-header-content">
                    {semester.isEditing ? (
                      <Input
                        type="text"
                        value={semester.name}
                        onChange={(e) => updateSemesterName(semester.id, e.target.value)}
                        className="semester-name-input"
                        placeholder={`Semester ${index + 1}`}
                        onBlur={() => toggleSemesterEdit(semester.id)}
                        aria-label="Semester name"
                        autoFocus
                      />
                    ) : (
                      <div className="semester-name-row">
                        <h2 className="semester-name">{semester.name}</h2>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSemesterEdit(semester.id)}
                          className="semester-edit-button"
                          aria-label={`Rename ${semester.name}`}
                        >
                          <Pencil className="semester-edit-icon" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                    <div className="semester-gpa-container">
                      <span className="semester-gpa-label">Semester QPA:</span>
                      <span className="semester-gpa-value tabular-nums">
                        {formatQpa(totals.qpa)}
                      </span>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="semester-delete-button"
                        aria-label={`Delete ${semester.name}`}
                      >
                        <Trash className="button-icon" aria-hidden="true" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {semester.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes the semester and all of its courses. This
                          action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeSemester(semester.id)}>
                          Delete Semester
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardHeader>
                <CardContent className="card-content">
                  <table className="course-table">
                    <caption className="sr-only">
                      Courses for {semester.name}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col" className="col-course">Course</th>
                        <th scope="col" className="col-units">Units</th>
                        <th scope="col" className="col-grade">Grade</th>
                        <th scope="col" className="col-qpts">Quality Pts</th>
                        <th scope="col" className="col-actions">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {semester.courses.map((course) => {
                        const missingGrade = course.grade === 'NO_GRADE';
                        return (
                          <tr key={course.id} className="course-row">
                            <td className="col-course" data-label="Course">
                              <Input
                                type="text"
                                placeholder="e.g. 15-122 Principles of Imperative Computation"
                                className="course-name-input"
                                value={course.name}
                                autoComplete="off"
                                spellCheck={false}
                                aria-label="Course name (optional)"
                                onChange={(e) => updateCourse(semester.id, course.id, 'name', e.target.value)}
                              />
                            </td>
                            <td className="col-units" data-label="Units">
                              <Input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="e.g. 9"
                                className="course-units-input tabular-nums"
                                value={course.units === '' ? '' : String(course.units)}
                                aria-label="Units"
                                onChange={(e) => handleUnitsChange(semester.id, course.id, e.target.value)}
                              />
                            </td>
                            <td className="col-grade" data-label="Grade">
                              <Select
                                value={course.grade || 'NO_GRADE'}
                                onValueChange={(value) => updateCourse(semester.id, course.id, 'grade', value)}
                              >
                                <SelectTrigger
                                  className={cn('course-grade-select', missingGrade && 'no-grade-text')}
                                  aria-label="Grade"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {GRADE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="col-qpts tabular-nums" data-label="Quality Pts">
                              {courseQualityPoints(course)}
                            </td>
                            <td className="col-actions">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeCourse(semester.id, course.id)}
                                className="course-delete-button"
                                aria-label={`Remove course ${course.name || 'row'}`}
                              >
                                <Trash className="button-icon" aria-hidden="true" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {semester.courses.length > 0 && (
                      <tfoot>
                        <tr className="course-total-row">
                          <th scope="row" className="col-course">Semester totals</th>
                          <td className="col-units tabular-nums">{totals.factorableUnits}</td>
                          <td className="col-grade" aria-hidden="true"></td>
                          <td className="col-qpts tabular-nums">{totals.qualityPoints.toFixed(1)}</td>
                          <td className="col-actions"></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => addCourse(semester.id)}
                    className="add-course-button"
                  >
                    <Plus className="button-icon" aria-hidden="true" />
                    Add Course
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      <div className="qpa-result" aria-live="polite">
        <h2 className="qpa-label">Cumulative QPA</h2>
        <p className="qpa-value tabular-nums">{formatQpa(cumulative.qpa)}</p>
        <p className="qpa-subtotal tabular-nums">
          {cumulative.factorableUnits} factorable units · {cumulative.qualityPoints.toFixed(1)} quality points
        </p>
      </div>
    </div>
  );
};

export default QpaCalculator;
