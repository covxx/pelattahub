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
import { Save } from "lucide-react"

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
  }
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition()
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Company Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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


