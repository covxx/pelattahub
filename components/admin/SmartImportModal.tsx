"use client"

import { useState, useTransition, useCallback, useRef } from "react"
import * as XLSX from "xlsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Upload, X, CheckCircle2, AlertTriangle, AlertCircle, Trash2, Wrench } from "lucide-react"
import { validateImportData, commitImport, type ValidateImportDataResult } from "@/app/actions/import"
import { useToast } from "@/hooks/useToast"
import { ToastContainer } from "@/components/ui/toast"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

type ImportType = "PRODUCT" | "CUSTOMER" | "VENDOR"

interface SmartImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: ImportType
}

type Step = "upload" | "review" | "commit"

interface ProcessedRecord {
  row: number
  data: Record<string, any>
  status: "valid" | "conflict" | "error"
  errors?: string[]
  existingId?: string
  existingData?: Record<string, any>
}

export function SmartImportModal({ open, onOpenChange, type }: SmartImportModalProps) {
  const [step, setStep] = useState<Step>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [rawData, setRawData] = useState<Array<Record<string, any>>>([])
  const [validation, setValidation] = useState<ValidateImportDataResult | null>(null)
  const [processedRecords, setProcessedRecords] = useState<ProcessedRecord[]>([])
  const [conflictResolutions, setConflictResolutions] = useState<Map<number, "OVERWRITE" | "SKIP">>(new Map())
  const [isValidating, startValidate] = useTransition()
  const [isImporting, startImport] = useTransition()
  const { toast, toasts, removeToast } = useToast()
  const router = useRouter()

  // Parse Excel/CSV file
  const parseFile = useCallback(async (file: File) => {
    return new Promise<Array<Record<string, any>>>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: "array" })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const jsonData = XLSX.utils.sheet_to_json(firstSheet) as Array<Record<string, any>>
          resolve(jsonData)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }, [])

  // Validate data
  const handleValidate = useCallback(async (data?: Array<Record<string, any>>) => {
    const dataToValidate = data || rawData
    if (dataToValidate.length === 0) return

    startValidate(async () => {
      try {
        const result = await validateImportData(type, dataToValidate)
        setValidation(result)

        // Build processed records array
        const processed: ProcessedRecord[] = []

        // Add valid records
        result.validRecords.forEach((record) => {
          processed.push({
            row: record.row,
            data: record.data,
            status: "valid",
          })
        })

        // Add conflicts
        result.conflicts.forEach((conflict) => {
          processed.push({
            row: conflict.row,
            data: conflict.data,
            status: "conflict",
            existingId: conflict.existingId,
            existingData: conflict.existingData,
          })
        })

        // Add errors
        result.errors.forEach((error) => {
          processed.push({
            row: error.row,
            data: error.data,
            status: "error",
            errors: error.errors,
          })
        })

        // Sort by row number
        processed.sort((a, b) => a.row - b.row)
        setProcessedRecords(processed)
      } catch (error) {
        toast("Validation failed", "error")
        console.error("Validation error:", error)
      }
    })
  }, [type, rawData, startValidate, toast])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  // Handle file selection
  const handleFileSelect = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile)

      try {
        const data = await parseFile(selectedFile)
        setRawData(data)
        setStep("review")
        // Auto-validate after a short delay to ensure state is set
        setTimeout(() => {
          handleValidate(data)
        }, 100)
      } catch (error) {
        toast("Failed to parse file", "error")
        console.error("Parse error:", error)
      }
    },
    [parseFile, toast, handleValidate]
  )

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }


  // Update record data (for inline editing)
  const updateRecordData = (row: number, field: string, value: any) => {
    setProcessedRecords((prev) =>
      prev.map((record) => {
        if (record.row === row) {
          const updatedData = { ...record.data, [field]: value }
          return { ...record, data: updatedData }
        }
        return record
      })
    )
  }

  // Remove row
  const removeRow = (row: number) => {
    setProcessedRecords((prev) => prev.filter((record) => record.row !== row))
    setRawData((prev) => prev.filter((_, i) => i + 1 !== row))
  }

  // Fix all (set defaults for common issues)
  const handleFixAll = () => {
    setProcessedRecords((prev) =>
      prev.map((record) => {
        if (record.status === "error") {
          const updatedData = { ...record.data }

          // Fix common issues based on type
          if (type === "PRODUCT") {
            if (!updatedData.unit_type) updatedData.unit_type = "CASE"
            if (!updatedData.default_origin_country) updatedData.default_origin_country = "USA"
            // Pad GTIN if needed
            if (updatedData.gtin) {
              const gtinDigits = updatedData.gtin.toString().replace(/\D/g, "")
              updatedData.gtin = gtinDigits.padStart(14, "0")
            }
          }

          // Re-validate this record
          const newErrors: string[] = []
          if (!updatedData.name || updatedData.name.trim() === "") {
            newErrors.push("Name is required")
          }
          if (type === "PRODUCT") {
            if (!updatedData.sku || updatedData.sku.trim() === "") {
              newErrors.push("SKU is required")
            }
            if (!updatedData.gtin || updatedData.gtin.length !== 14) {
              newErrors.push("GTIN must be 14 digits")
            }
          } else {
            if (!updatedData.code || updatedData.code.trim() === "") {
              newErrors.push("Code is required")
            }
          }

          return {
            ...record,
            data: updatedData,
            status: newErrors.length > 0 ? "error" : "valid",
            errors: newErrors.length > 0 ? newErrors : undefined,
          }
        }
        return record
      })
    )
  }

  // Set conflict resolution
  const setConflictResolution = (row: number, resolution: "OVERWRITE" | "SKIP") => {
    setConflictResolutions((prev) => {
      const newMap = new Map(prev)
      newMap.set(row, resolution)
      return newMap
    })
  }

  // Commit import
  const handleCommit = async () => {
    if (!validation) return

    // Check if there are still errors
    const hasErrors = processedRecords.some((r) => r.status === "error")
    if (hasErrors) {
      toast("Please fix all errors before importing", "error")
      return
    }

    // Prepare records for commit
    const recordsToCommit = processedRecords
      .filter((record) => {
        // Skip if conflict resolution is SKIP
        if (record.status === "conflict") {
          const resolution = conflictResolutions.get(record.row)
          return resolution !== "SKIP"
        }
        return true
      })
      .map((record) => ({
        row: record.row,
        data: record.data,
        existingId: record.existingId,
        conflictResolution:
          record.status === "conflict"
            ? conflictResolutions.get(record.row) || "SKIP"
            : undefined,
      }))

    startImport(async () => {
      try {
        const result = await commitImport(type, recordsToCommit)

        if (result.success) {
          toast(
            `Import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
            "success"
          )
          router.refresh()
          handleClose()
        } else {
          toast(result.error || "Import failed", "error")
        }
      } catch (error) {
        toast("Import failed", "error")
        console.error("Import error:", error)
      }
    })
  }

  // Reset and close
  const handleClose = () => {
    setStep("upload")
    setFile(null)
    setRawData([])
    setValidation(null)
    setProcessedRecords([])
    setConflictResolutions(new Map())
    onOpenChange(false)
  }

  // Get column headers based on type
  const getColumns = () => {
    if (type === "PRODUCT") {
      return [
        { label: "SKU", key: "sku" },
        { label: "Name", key: "name" },
        { label: "GTIN", key: "gtin" },
        { label: "Unit Type", key: "unit_type" },
        { label: "Origin Country", key: "default_origin_country" },
        { label: "Variety", key: "variety" },
        { label: "Description", key: "description" },
      ]
    } else if (type === "CUSTOMER") {
      return [
        { label: "Code", key: "code" },
        { label: "Name", key: "name" },
        { label: "Address", key: "address" },
        { label: "Contact Email", key: "contact_email" },
      ]
    } else {
      return [
        { label: "Code", key: "code" },
        { label: "Name", key: "name" },
      ]
    }
  }

  // Get field value for display
  const getFieldValue = (record: ProcessedRecord, key: string) => {
    return record.data[key] || ""
  }

  // Count records ready to import
  const getReadyCount = () => {
    return processedRecords.filter((r) => {
      if (r.status === "error") return false
      if (r.status === "conflict") {
        const resolution = conflictResolutions.get(r.row)
        return resolution === "OVERWRITE"
      }
      return true
    }).length
  }

  const hasErrors = processedRecords.some((r) => r.status === "error")

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import {type}s</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to import {type.toLowerCase()}s in bulk
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={onFileChange}
                className="hidden"
              />
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                {isDragActive ? "Drop the file here" : "Drag & drop a file here"}
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse (CSV, XLS, XLSX)
              </p>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            {isValidating && (
              <div className="text-center py-4">
                <p className="text-muted-foreground">Validating data...</p>
              </div>
            )}

            {validation && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>{validation.summary.valid} Valid</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span>{validation.summary.conflicts} Conflicts</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span>{validation.summary.errors} Errors</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFixAll}
                      disabled={validation.summary.errors === 0}
                    >
                      <Wrench className="h-4 w-4 mr-2" />
                      Fix All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleValidate()}
                      disabled={isValidating}
                    >
                      Re-validate
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-[60vh]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-12">Row</TableHead>
                          <TableHead className="w-12">Status</TableHead>
                          {getColumns().map((col) => (
                            <TableHead key={col.key}>{col.label}</TableHead>
                          ))}
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedRecords.map((record) => {
                          const isError = record.status === "error"
                          const isConflict = record.status === "conflict"
                          const isValid = record.status === "valid"

                          return (
                            <TableRow
                              key={record.row}
                              className={cn(
                                isError && "bg-red-50 dark:bg-red-950/20",
                                isConflict && "bg-yellow-50 dark:bg-yellow-950/20",
                                isValid && "bg-green-50 dark:bg-green-950/20"
                              )}
                            >
                              <TableCell className="font-mono text-xs">{record.row}</TableCell>
                              <TableCell>
                                {isError && (
                                  <Badge variant="destructive" className="text-xs">
                                    Error
                                  </Badge>
                                )}
                                {isConflict && (
                                  <Badge className="bg-yellow-500 text-white text-xs">
                                    ⚠️ Update
                                  </Badge>
                                )}
                                {isValid && (
                                  <Badge className="bg-green-500 text-white text-xs">
                                    Valid
                                  </Badge>
                                )}
                              </TableCell>
                              {getColumns().map((col) => {
                                const value = getFieldValue(record, col.key)
                                const isRequired =
                                  (type === "PRODUCT" && (col.key === "name" || col.key === "sku" || col.key === "gtin" || col.key === "default_origin_country")) ||
                                  (type !== "PRODUCT" && (col.key === "name" || col.key === "code"))
                                const hasError = isError && isRequired && !value
                                const fieldError = record.errors?.find((e) =>
                                  e.toLowerCase().includes(col.key) || e.toLowerCase().includes(col.label.toLowerCase())
                                )

                                return (
                                  <TableCell key={col.key}>
                                    {isError && isRequired ? (
                                      <div>
                                        <Input
                                          value={value}
                                          onChange={(e) =>
                                            updateRecordData(record.row, col.key, e.target.value)
                                          }
                                          className={cn(
                                            "h-8 text-sm",
                                            hasError && "border-red-500"
                                          )}
                                          placeholder={`Enter ${col.label.toLowerCase()}`}
                                        />
                                        {fieldError && (
                                          <p className="text-xs text-red-600 mt-1">{fieldError}</p>
                                        )}
                                      </div>
                                    ) : (
                                      <div>
                                        <span className="text-sm">{value || "-"}</span>
                                        {fieldError && (
                                          <p className="text-xs text-red-600 mt-1">{fieldError}</p>
                                        )}
                                      </div>
                                    )}
                                    {isConflict && col.key === "code" && record.existingData && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Existing: {record.existingData.code}
                                      </p>
                                    )}
                                    {isConflict && type === "PRODUCT" && col.key === "sku" && record.existingData && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Existing: {record.existingData.sku}
                                      </p>
                                    )}
                                  </TableCell>
                                )
                              })}
                              <TableCell>
                                <div className="flex gap-2">
                                  {isConflict && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() =>
                                          setConflictResolution(record.row, "OVERWRITE")
                                        }
                                        disabled={
                                          conflictResolutions.get(record.row) === "OVERWRITE"
                                        }
                                      >
                                        Update
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() =>
                                          setConflictResolution(record.row, "SKIP")
                                        }
                                        disabled={conflictResolutions.get(record.row) === "SKIP"}
                                      >
                                        Skip
                                      </Button>
                                    </>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => removeRow(record.row)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {step === "commit" && (
          <div className="space-y-4">
            <div className="text-center py-8">
              <p className="text-lg font-medium mb-2">Ready to import</p>
              <p className="text-muted-foreground">
                {getReadyCount()} records will be imported
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </>
          )}

          {step === "review" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("commit")
                }}
                disabled={hasErrors || isValidating}
              >
                Continue
              </Button>
            </>
          )}

          {step === "commit" && (
            <>
              <Button variant="outline" onClick={() => setStep("review")}>
                Back
              </Button>
              <Button
                onClick={handleCommit}
                disabled={hasErrors || isImporting || getReadyCount() === 0}
              >
                {isImporting ? "Importing..." : `Import ${getReadyCount()} Records`}
              </Button>
            </>
          )}
        </DialogFooter>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </DialogContent>
    </Dialog>
  )
}

