"use client";

import { useState, useRef } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function DataBackupCard() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/settings/backup");
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to export backup");
      }

      const blob = await res.blob();

      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+?)"/);
      const filename = filenameMatch?.[1] ?? "pillar-backup.json";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Backup exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export");
    } finally {
      setExporting(false);
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      JSON.parse(text);
      setPendingFile(text);
      setShowConfirm(true);
    } catch {
      toast.error("Invalid JSON file");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleConfirmImport() {
    if (!pendingFile) return;

    setShowConfirm(false);
    setImporting(true);
    try {
      const res = await fetch("/api/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: pendingFile,
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to import backup");
      }

      const { summary } = await res.json();
      const parts: string[] = [];
      if (summary.categories) parts.push(`${summary.categories} categories`);
      if (summary.labels) parts.push(`${summary.labels} labels`);
      if (summary.projects) parts.push(`${summary.projects} projects`);
      if (summary.tasks) parts.push(`${summary.tasks} tasks`);
      if (summary.notes) parts.push(`${summary.notes} notes`);

      toast.success(
        parts.length > 0
          ? `Imported ${parts.join(", ")}`
          : "Backup imported (no data)",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import");
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  }

  function handleCancelImport() {
    setShowConfirm(false);
    setPendingFile(null);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Data Backup</CardTitle>
          <CardDescription>
            Export or import your data as a JSON file for backup or migration
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
          >
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exporting..." : "Export backup"}
          </Button>
          <Button
            variant="outline"
            onClick={handleImportClick}
            disabled={importing}
          >
            <Upload className="mr-2 h-4 w-4" />
            {importing ? "Importing..." : "Import backup"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileSelected}
          />
        </CardContent>
      </Card>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all your existing data including categories,
              projects, tasks, labels, and notes. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelImport}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>
              Yes, import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
