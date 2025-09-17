import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Users, 
  FileSpreadsheet,
  Info,
  Eye,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { 
  CsvImportResult, 
  CsvTalentRow 
} from "@shared/schema";

interface CSVTalentImportProps {
  onImportComplete?: (result: CsvImportResult) => void;
}

interface ValidationResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: Array<{ row: number; field: string; message: string; data?: any }>;
  duplicateEmails: string[];
  sampleValidRows: CsvTalentRow[];
}

interface ImportResultWithErrors extends CsvImportResult {
  errors?: Array<{ row: number; message: string }>;
  requestId: string;
}

type ImportResult = ImportResultWithErrors;

export function CSVTalentImport({ onImportComplete }: CSVTalentImportProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      setValidationResult(null);
      setImportResult(null);
      toast({
        title: "File uploaded",
        description: `${file.name} ready for validation`,
      });
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    onDropRejected: (fileRejections) => {
      const rejection = fileRejections[0];
      if (rejection) {
        toast({
          variant: "destructive",
          title: "File rejected",
          description: rejection.errors[0]?.message || "Invalid file",
        });
      }
    },
  });

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/admin/csv-import/template/download', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'onspot_talent_import_template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Template downloaded",
        description: "CSV template file has been downloaded to your device",
      });
    } catch (error) {
      console.error('Template download error:', error);
      toast({
        variant: "destructive",
        title: "Download failed",
        description: "Failed to download CSV template",
      });
    }
  };

  const validateFile = async () => {
    if (!uploadedFile) return;

    setIsValidating(true);
    try {
      const formData = new FormData();
      formData.append('csvFile', uploadedFile);

      const response = await fetch('/api/admin/csv-import/validate', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Validation failed');
      }

      const result: ValidationResult = await response.json();
      setValidationResult(result);

      if (result.success) {
        toast({
          title: "Validation successful",
          description: `${result.validRows} rows ready for import`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Validation issues found",
          description: `${result.errorRows} rows have errors that need to be fixed`,
        });
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast({
        variant: "destructive",
        title: "Validation failed",
        description: error instanceof Error ? error.message : "An error occurred during validation",
      });
      setValidationResult(null);
    } finally {
      setIsValidating(false);
    }
  };

  const importTalents = async () => {
    if (!uploadedFile || !validationResult) return;

    setIsImporting(true);
    setImportProgress(0);

    try {
      const formData = new FormData();
      formData.append('csvFile', uploadedFile);
      formData.append('skipDuplicateEmails', skipDuplicates.toString());

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/admin/csv-import/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Import failed');
      }

      const result: ImportResult = await response.json();
      setImportResult(result);

      toast({
        title: "Import completed",
        description: `Successfully imported ${result.successfulRows} talents`,
      });

      onImportComplete?.(result);

    } catch (error) {
      console.error('Import error:', error);
      toast({
        variant: "destructive",
        title: "Import failed",
        description: error instanceof Error ? error.message : "An error occurred during import",
      });
    } finally {
      setIsImporting(false);
      setTimeout(() => setImportProgress(0), 2000);
    }
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setValidationResult(null);
    setImportResult(null);
    setImportProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6" data-testid="csv-talent-import">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-primary">CSV Talent Import</h2>
          <p className="text-muted-foreground">
            Bulk import talent profiles from CSV files
          </p>
        </div>
        <Button 
          onClick={downloadTemplate} 
          variant="outline"
          className="gap-2"
          data-testid="button-download-template"
        >
          <Download className="w-4 h-4" />
          Download Template
        </Button>
      </div>

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Import Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Required Fields</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• First Name</li>
                <li>• Last Name</li>
                <li>• Email (must be unique)</li>
                <li>• Professional Title</li>
                <li>• Biography/Description</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Optional Fields</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Location, Phone Number</li>
                <li>• Hourly Rate, Currency</li>
                <li>• Languages, Timezone</li>
                <li>• Skills (comma-separated)</li>
              </ul>
            </div>
          </div>
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Download the template above to ensure your CSV file has the correct format and headers.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Upload CSV File
          </CardTitle>
          <CardDescription>
            Select or drag and drop your CSV file (max 10MB)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive 
                ? "border-primary bg-primary/5" 
                : uploadedFile 
                  ? "border-green-500 bg-green-50 dark:bg-green-950/20" 
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
              }
            `}
            data-testid="csv-dropzone"
          >
            <input {...getInputProps()} ref={fileInputRef} />
            
            {uploadedFile ? (
              <div className="space-y-2">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                <div>
                  <p className="font-medium">{uploadedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    resetUpload();
                  }}
                  data-testid="button-remove-file"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Remove File
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className={`w-12 h-12 mx-auto ${isDragActive ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-lg font-medium">
                    {isDragActive ? "Drop the CSV file here" : "Upload CSV File"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isDragActive 
                      ? "Release to upload your file" 
                      : "Drag and drop your CSV file here, or click to browse"
                    }
                  </p>
                </div>
              </div>
            )}
          </div>

          {uploadedFile && !validationResult && (
            <div className="mt-4 flex justify-center">
              <Button
                onClick={validateFile}
                disabled={isValidating}
                className="gap-2"
                data-testid="button-validate-csv"
              >
                {isValidating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Validate CSV
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Results */}
      {validationResult && (
        <Card data-testid="validation-results">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {validationResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-500" />
              )}
              Validation Results
            </CardTitle>
            <CardDescription>
              Analysis of your CSV file data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">{validationResult.totalRows}</div>
                <div className="text-sm text-muted-foreground">Total Rows</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">{validationResult.validRows}</div>
                <div className="text-sm text-muted-foreground">Valid Rows</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-red-600">{validationResult.errorRows}</div>
                <div className="text-sm text-muted-foreground">Error Rows</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{validationResult.duplicateEmails.length}</div>
                <div className="text-sm text-muted-foreground">Duplicates</div>
              </div>
            </div>

            {/* Error Details */}
            {validationResult.errorRows > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Validation Errors</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowValidationDetails(!showValidationDetails)}
                    data-testid="button-toggle-errors"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {showValidationDetails ? "Hide" : "Show"} Details
                  </Button>
                </div>
                
                {showValidationDetails && (
                  <ScrollArea className="h-40 border rounded p-2">
                    <div className="space-y-1">
                      {validationResult.errors.map((error, index) => (
                        <div key={index} className="text-sm">
                          <Badge variant="destructive" className="mr-2">Row {error.row}</Badge>
                          <span className="text-muted-foreground">{error.field}:</span> {error.message}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* Duplicate Emails */}
            {validationResult.duplicateEmails.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Duplicate Emails Found</h4>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="skip-duplicates"
                    checked={skipDuplicates}
                    onCheckedChange={setSkipDuplicates}
                    data-testid="switch-skip-duplicates"
                  />
                  <Label htmlFor="skip-duplicates" className="text-sm">
                    Skip rows with duplicate emails
                  </Label>
                </div>
                <div className="text-sm text-muted-foreground">
                  Duplicates: {validationResult.duplicateEmails.join(", ")}
                </div>
              </div>
            )}

            <Separator />

            {/* Import Button */}
            {validationResult.validRows > 0 && (
              <div className="flex justify-center">
                <Button
                  onClick={importTalents}
                  disabled={isImporting}
                  className="gap-2"
                  data-testid="button-import-talents"
                >
                  {isImporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4" />
                      Import {validationResult.validRows} Talents
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Import Progress */}
            {isImporting && importProgress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Import Progress</span>
                  <span>{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import Results */}
      {importResult && (
        <Card data-testid="import-results">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Import Complete
            </CardTitle>
            <CardDescription>
              Summary of the talent import operation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">{importResult.totalRows}</div>
                <div className="text-sm text-muted-foreground">Total Processed</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">{importResult.successfulRows}</div>
                <div className="text-sm text-muted-foreground">Successful</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-red-600">{importResult.failedRows}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{importResult.summary.duplicatesSkipped}</div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
            </div>

            {/* Import Summary */}
            <div className="space-y-2">
              <h4 className="font-medium">Import Summary</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Users created: {importResult.summary.usersCreated}</li>
                <li>• Profiles created: {importResult.summary.profilesCreated}</li>
                <li>• Skills linked: {importResult.summary.skillsLinked}</li>
                <li>• Errors: {importResult.summary.errors}</li>
              </ul>
            </div>

            {importResult.failedRows > 0 && importResult.results && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Import Errors</h4>
                <ScrollArea className="h-32 border rounded p-2">
                  <div className="space-y-1">
                    {importResult.results.filter(result => !result.success).map((result, index) => (
                      <div key={index} className="text-sm">
                        <Badge variant="destructive" className="mr-2">Row {result.rowIndex + 1}</Badge>
                        {result.error || 'Unknown error'}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="flex justify-center">
              <Button onClick={resetUpload} variant="outline" data-testid="button-import-another">
                Import Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}