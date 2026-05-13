"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash, Upload, Plus, Info, Pencil } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast"
import { parseCMUTranscript } from '@/lib/utils';
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
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

const gradePoints: { [key: string]: number | null } = {
  "A": 4.0,
  "B": 3.0,
  "C": 2.0,
  "D": 1.0,
  "R": 0.0,
  "NO_GRADE": null
};

const calculateSemesterGpa = (courses: Course[]): number => {
  let totalQualityPoints = 0;
  let totalFactorableUnits = 0;
  
  courses.forEach(course => {
    const points = gradePoints[course.grade];
    const units = typeof course.units === 'string' ? parseFloat(course.units) : course.units;
    if (points !== null && points !== undefined && units !== undefined && !isNaN(units)) {
      totalQualityPoints += units * points;
      totalFactorableUnits += units;
    }
  });

  if (totalFactorableUnits === 0) return 0.0;
  return parseFloat((totalQualityPoints / totalFactorableUnits).toFixed(2));
};

const QpaCalculator = () => {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [qpa, setQpa] = useState<number>(0.0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedSemesters = localStorage.getItem('semesters');
    if (storedSemesters) {
      setSemesters(JSON.parse(storedSemesters));
    } else {
      setSemesters([{ id: crypto.randomUUID(), name: `Semester 1`, courses: [] }]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('semesters', JSON.stringify(semesters));
    calculateQpa();
  }, [semesters]);

  const addSemester = () => {
    setSemesters(prevSemesters => [
      ...prevSemesters,
      {
        id: crypto.randomUUID(),
        name: `Semester ${prevSemesters.length + 1}`,
        courses: [],
      }
    ]);
  };

  const removeSemester = (id: string) => {
    setSemesters(prevSemesters => {
      const updatedSemesters = prevSemesters.filter(semester => semester.id !== id);
      // If we're removing the last semester, add a new empty one
      if (updatedSemesters.length === 0) {
        return [{ id: crypto.randomUUID(), name: 'Semester 1', courses: [] }];
      }
      return updatedSemesters;
    });
  };

  const addCourse = (semesterId: string) => {
    setSemesters(prevSemesters =>
      prevSemesters.map(semester =>
        semester.id === semesterId
          ? {
            ...semester,
            courses: [
              ...semester.courses,
              {
                id: crypto.randomUUID(),
                name: '',
                units: '',
                grade: 'NO_GRADE'
              }
            ],
          }
          : semester
      )
    );
  };

  const removeCourse = (semesterId: string, courseId: string) => {
    setSemesters(prevSemesters =>
      prevSemesters.map(semester =>
        semester.id === semesterId
          ? {
            ...semester,
            courses: semester.courses.filter(course => course.id !== courseId),
          }
          : semester
      )
    );
  };

  const updateCourse = (semesterId: string, courseId: string, field: string, value: string | number) => {
    setSemesters(prevSemesters =>
      prevSemesters.map(semester =>
        semester.id === semesterId
          ? {
            ...semester,
            courses: semester.courses.map(course =>
              course.id === courseId
                ? { ...course, [field]: value }
                : course
            ),
          }
          : semester
      )
    );
  };

  const updateSemesterName = (semesterId: string, newName: string) => {
    setSemesters(prevSemesters =>
      prevSemesters.map((semester, idx) =>
        semester.id === semesterId
          ? { ...semester, name: newName || `Semester ${idx + 1}`, isEditing: false }
          : semester
      )
    );
  };

  const toggleSemesterEdit = (semesterId: string) => {
    setSemesters(prevSemesters =>
      prevSemesters.map(semester =>
        semester.id === semesterId
          ? { ...semester, isEditing: !semester.isEditing }
          : semester
      )
    );
  };

  const calculateQpa = useCallback(() => {
    let totalQualityPoints = 0;
    let totalFactorableUnits = 0;
    semesters.forEach(semester => {
      semester.courses.forEach(course => {
        const points = gradePoints[course.grade];
        const units = typeof course.units === 'string' ? parseFloat(course.units) : course.units;
        // Only factor in grades that have numeric grade points (excludes P, R, W, N)
        if (points !== null && points !== undefined && units !== undefined && !isNaN(units)) {
          totalQualityPoints += units * points;
          totalFactorableUnits += units;
        }
      });
    });
    if (totalFactorableUnits === 0) {
      setQpa(0.0);
    } else {
      setQpa(parseFloat((totalQualityPoints / totalFactorableUnits).toFixed(2)));
    }
  }, [semesters]);

  const handleUnitsChange = (semesterId: string, courseId: string, value: string) => {
    // If the value is empty, keep it as empty string
    // Otherwise, convert to integer by removing the decimal part
    const processedValue = value === '' ? '' : Math.floor(parseFloat(value));
    updateCourse(semesterId, courseId, 'units', processedValue);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('Please upload a PDF file');
      }
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
          grade: course.grade
        }))
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
          All data processing happens locally in your browser - your academic records are never sent to any server.
        </p>
      </div>

      <div className="qpa-actions">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          className="file-input-hidden"
          ref={fileInputRef}
        />
        <Button 
          className="import-button" 
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="button-icon" />
          Import from Academic Record
        </Button>
        <Button 
          className="add-semester-button" 
          variant="outline" 
          onClick={addSemester}
        >
          <Plus className="button-icon" />
          Add Semester Manually
        </Button>
      </div>

      <ScrollArea 
        className="semester-scroll-area" 
      >
        <div ref={scrollContainerRef} className="semester-list">
          {semesters.map((semester, index) => {
            const semesterGpa = calculateSemesterGpa(semester.courses);
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
                        autoFocus
                      />
                    ) : (
                      <div className="semester-name-row">
                        <h3 className="semester-name">{semester.name}</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSemesterEdit(semester.id)}
                          className="semester-edit-button"
                        >
                          <Pencil className="semester-edit-icon" />
                        </Button>
                      </div>
                    )}
                    <div className="semester-gpa-container">
                      <span className="semester-gpa-label">Semester GPA:</span>
                      <span className="semester-gpa-value">{semesterGpa}</span>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="semester-delete-button"
                    onClick={() => removeSemester(semester.id)}
                  >
                    <Trash className="button-icon" />
                  </Button>
                </CardHeader>
                <CardContent className="card-content">
                  <div className="course-list">
                    {semester.courses.map(course => (
                      <div key={course.id} className="course-row">
                        <Input
                          type="text"
                          placeholder="Course Name (Optional)"
                          className="course-name-input"
                          value={course.name}
                          onChange={(e) => updateCourse(semester.id, course.id, 'name', e.target.value)}
                        />
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="Units"
                          className="course-units-input"
                          value={course.units === '' ? '' : String(course.units)}
                          onChange={(e) => {
                            // Only allow integer values by removing any non-digit characters
                            const sanitizedValue = e.target.value.replace(/[^0-9]/g, '');
                            handleUnitsChange(semester.id, course.id, sanitizedValue);
                          }}
                        />
                        
                        <CustomSelect 
                          options={[
                            { value: "NO_GRADE", label: "No Grade" },
                            { value: "A", label: "A" },
                            { value: "B", label: "B" },
                            { value: "C", label: "C" },
                            { value: "D", label: "D" },
                            { value: "R", label: "R" }
                          ]}
                          value={course.grade || "NO_GRADE"}
                          onValueChange={(value) => updateCourse(semester.id, course.id, 'grade', value)}
                          className="course-grade-select"
                          triggerClassName={cn(
                            (!course.grade || course.grade === "NO_GRADE") && "no-grade-text"
                          )}
                        />
                        
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => removeCourse(semester.id, course.id)} 
                          className="course-delete-button"
                        >
                          <Trash className="button-icon" />
                        </Button>
                      </div>
                    ))}
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={() => addCourse(semester.id)} 
                      className="add-course-button"
                    >
                      <Plus className="button-icon" />
                      Add Course
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      <div className="qpa-result">
        <h3 className="qpa-label">Your QPA:</h3>
        <p className="qpa-value">{qpa}</p>
      </div>
    </div>
  );
};

export default QpaCalculator;
