"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/useToast"
import { ToastContainer } from "@/components/ui/toast"
import { updateCompanySettings } from "@/app/actions/settings"
import { Save, Upload, X, Image as ImageIcon } from "lucide-react"

const settingsSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  company_address: z.string().min(1, "Company address is required"),
  gs1_prefix: z.string().optional(),
})

type SettingsFormValues = z.infer<typeof settingsSchema>

interface SettingsFormProps {
  initialSettings: {
    name: string
    address: string
    gs1_prefix: string
    logo_url?: string
  }
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition()
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | undefined>(initialSettings.logo_url)
  const [logoPreview, setLogoPreview] = useState<string | null>(
    initialSettings.logo_url || null
  )
  const { toast, toasts, removeToast } = useToast()

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      company_name: initialSettings.name,
      company_address: initialSettings.address,
      gs1_prefix: initialSettings.gs1_prefix,
    },
  })

  const onSubmit = (data: SettingsFormValues) => {
    startTransition(async () => {
      const result = await updateCompanySettings({
        company_name: data.company_name,
        company_address: data.company_address,
        gs1_prefix: data.gs1_prefix,
      })

      if (result.success) {
        toast("Settings saved successfully!", "success")
      } else {
        toast(result.error || "Failed to save settings", "error")
      }
    })
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      toast("Invalid file type. Please upload PNG, JPEG, GIF, or WebP", "error")
      return
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSize) {
      toast("File size too large. Maximum size is 2MB", "error")
      return
    }

    setIsUploadingLogo(true)

    try {
      const formData = new FormData()
      formData.append("logo", file)

      const response = await fetch("/api/settings/logo", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Create preview from file
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64String = reader.result as string
          setLogoPreview(base64String)
          setLogoUrl(base64String)
        }
        reader.readAsDataURL(file)
        toast("Logo uploaded successfully!", "success")
      } else {
        toast(result.error || "Failed to upload logo", "error")
      }
    } catch (error) {
      console.error("Error uploading logo:", error)
      toast("Failed to upload logo. Please try again.", "error")
    } finally {
      setIsUploadingLogo(false)
      // Reset input
      e.target.value = ""
    }
  }

  const handleDeleteLogo = async () => {
    try {
      const response = await fetch("/api/settings/logo", {
        method: "DELETE",
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setLogoPreview(null)
        setLogoUrl(undefined)
        toast("Logo deleted successfully!", "success")
      } else {
        toast(result.error || "Failed to delete logo", "error")
      }
    } catch (error) {
      console.error("Error deleting logo:", error)
      toast("Failed to delete logo. Please try again.", "error")
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Company Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Company Logo */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Company Logo
                </label>
                <div className="flex items-start gap-4">
                  {logoPreview ? (
                    <div className="relative">
                      <div className="relative w-32 h-32 border-2 border-border rounded-md overflow-hidden bg-muted">
                        <img
                          src={logoPreview}
                          alt="Company logo"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                        onClick={handleDeleteLogo}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="w-32 h-32 border-2 border-dashed border-border rounded-md flex items-center justify-center bg-muted">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="logo-upload"
                        className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {logoPreview ? "Replace Logo" : "Upload Logo"}
                      </label>
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                        onChange={handleLogoUpload}
                        disabled={isUploadingLogo}
                        className="hidden"
                      />
                      {isUploadingLogo && (
                        <span className="text-sm text-muted-foreground">Uploading...</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Upload a company logo to display on receiving receipts. Max size: 2MB.
                      Supported formats: PNG, JPEG, GIF, WebP.
                    </p>
                  </div>
                </div>
              </div>
              {/* Company Name */}
              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Fresh Produce Co."
                        {...field}
                        className="text-lg"
                      />
                    </FormControl>
                    <FormDescription>
                      Displayed on labels and receipts
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Company Address */}
              <FormField
                control={form.control}
                name="company_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Address *</FormLabel>
                    <FormControl>
                      <textarea
                        placeholder="123 Growers Ln&#10;Salinas, CA 93901"
                        {...field}
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        rows={3}
                      />
                    </FormControl>
                    <FormDescription>
                      Multi-line address for receipts (street, city, state, zip)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* GS1 Company Prefix */}
              <FormField
                control={form.control}
                name="gs1_prefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GS1 Company Prefix (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="000000"
                        {...field}
                        className="font-mono"
                        maxLength={12}
                      />
                    </FormControl>
                    <FormDescription>
                      Your GS1 company prefix for GTIN validation (6-12 digits).
                      Leave as 000000 if not applicable.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Save Button */}
              <div className="flex justify-end">
                <Button type="submit" disabled={isPending} size="lg">
                  <Save className="h-4 w-4 mr-2" />
                  {isPending ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  )
}


