"use client"

import { useEffect, useRef } from "react"
import { useFormState, useFormStatus } from "react-dom"

import { submitContact, type ContactFormState } from "@/app/actions/contact"

const initialState: ContactFormState = { success: false, error: undefined }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      className="inline-flex w-full items-center justify-center rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-sm transition hover:-translate-y-0.5 hover:shadow-foreground/20 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "Sending…" : "Send message"}
    </button>
  )
}

export default function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction] = useFormState(submitContact, initialState)

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset()
    }
  }, [state?.success])

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm shadow-inner shadow-muted/30 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Alex Rivera"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="email">
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm shadow-inner shadow-muted/30 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="alex@produceco.com"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="company">
            Company
          </label>
          <input
            id="company"
            name="company"
            required
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm shadow-inner shadow-muted/30 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Paletta Fresh"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="phone">
            Phone (optional)
          </label>
          <input
            id="phone"
            name="phone"
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm shadow-inner shadow-muted/30 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="(555) 555-1234"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="message">
          What do you want to improve?
        </label>
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          rows={4}
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm shadow-inner shadow-muted/30 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="Tell us about your receiving, picking, or labeling needs."
        />
      </div>

      {state?.error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
          Thanks! We received your message and will reach out shortly.
        </div>
      ) : null}

      <SubmitButton />
    </form>
  )
}
