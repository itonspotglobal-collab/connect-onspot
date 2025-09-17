import { CSVTalentImport } from "@/components/CSVTalentImport";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, FileSpreadsheet, Shield, TrendingUp } from "lucide-react";
import type { CsvImportResult } from "@shared/schema";

export default function AdminCSVImport() {
  const handleImportComplete = (result: CsvImportResult) => {
    // Could trigger refresh of talent list, show detailed success message, etc.
    console.log('Import completed:', result);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-8" data-testid="admin-csv-import-page">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Bulk talent management and CSV import tools
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Shield className="w-3 h-3" />
            Admin Access Required
          </Badge>
        </div>
      </div>

      {/* Stats Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bulk Import</CardTitle>
            <FileSpreadsheet className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">CSV Upload</div>
            <p className="text-xs text-muted-foreground">
              Import multiple talent profiles at once
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Efficiency</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">10x Faster</div>
            <p className="text-xs text-muted-foreground">
              Compared to manual entry
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
            <Users className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">Validated</div>
            <p className="text-xs text-muted-foreground">
              Automatic validation and error handling
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main CSV Import Component */}
      <CSVTalentImport onImportComplete={handleImportComplete} />

      {/* Help Section */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            CSV Import Best Practices
          </CardTitle>
          <CardDescription>
            Tips for successful bulk talent imports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Data Preparation</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Use the provided CSV template</li>
                <li>• Ensure email addresses are unique</li>
                <li>• Keep file size under 10MB</li>
                <li>• Use UTF-8 encoding for international characters</li>
                <li>• Separate multiple skills with commas</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Quality Guidelines</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Write clear, professional biographies</li>
                <li>• Use standard timezone identifiers</li>
                <li>• Include accurate hourly rates</li>
                <li>• Validate phone number formats</li>
                <li>• Ensure consistent data formatting</li>
              </ul>
            </div>
          </div>
          
          <div className="bg-background border rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-2">Sample CSV Data Format</h4>
            <code className="text-xs bg-muted p-2 rounded block whitespace-pre-wrap">
{`firstName,lastName,email,title,bio,location,hourlyRate,skills
John,Doe,john.doe@example.com,Senior Developer,"Full-stack developer with 5+ years experience",Manila,25.00,"JavaScript,React,Node.js"
Maria,Santos,maria@example.com,Digital Marketer,"Social media and content marketing specialist",Cebu,20.00,"Social Media,Content Writing,SEO"`}
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}