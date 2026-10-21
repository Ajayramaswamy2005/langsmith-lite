import React, { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mark } from "@/components/bench"
import { useAuth } from "@/context/AuthContext"

export default function Login() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, login, register, googleSignIn } = useAuth()

  const [mode, setMode] = useState(params.get("mode") === "signup" ? "signup" : "signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(null)

  useEffect(() => {
    if (user) navigate("/app", { replace: true })
  }, [user, navigate])

  useEffect(() => {
    document.title = mode === "signup" ? "Create an account — LangSmith Lite" : "Sign in — LangSmith Lite"
  }, [mode])

  const submit = async (event) => {
    event.preventDefault()
    setProblem(null)
    setBusy(true)
    try {
      if (mode === "signup") {
        await register(email, password, name)
        toast.success("Account created", { description: email })
      } else {
        await login(email, password)
        toast.success("Signed in", { description: email })
      }
      navigate("/app")
    } catch (err) {
      setProblem(err.message)
    } finally {
      setBusy(false)
    }
  }

  // The backend trusts the address for Gmail sign-in; there is no OAuth round
  // trip in this build, so the form says exactly what it does.
  const withGoogle = async () => {
    if (!email.trim()) {
      setProblem("Enter the Gmail address you want to sign in with.")
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      await googleSignIn(email, name || undefined)
      toast.success("Signed in", { description: email })
      navigate("/app")
    } catch (err) {
      setProblem(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      {/* ------------------------------- form ----------------------------- */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/" aria-label="LangSmith Lite home">
          <Mark />
        </Link>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="display-lg">
            {mode === "signup" ? "Create an account" : "Sign in"}
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
            {mode === "signup"
              ? "An account shares your datasets and baselines across machines. The bench itself runs locally either way."
              : "Welcome back. Your datasets, runs and baselines are where you left them."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="lg-name">Your name</Label>
                <Input
                  id="lg-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="lg-email">Email</Label>
              <Input
                id="lg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lg-password">Password</Label>
              <Input
                id="lg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={mode === "signup" ? 8 : undefined}
              />
              {mode === "signup" && (
                <p className="text-[11.5px] text-ink-faint">At least 8 characters.</p>
              )}
            </div>

            {problem && (
              <p className="border-l-2 border-[#a9201a] bg-[#fbeeed] px-3 py-2 text-[12.5px] text-ink-soft">
                {problem}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Working" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-rule" />
            <span className="text-[11.5px] text-ink-faint">or</span>
            <span className="h-px flex-1 bg-rule" />
          </div>

          <Button variant="outline" className="w-full" onClick={withGoogle} disabled={busy}>
            Continue with the Gmail address above
          </Button>
          <p className="mt-2 text-[11.5px] leading-snug text-ink-faint">
            This build trusts the address rather than running an OAuth round
            trip, so use it for local work only.
          </p>

          <p className="mt-8 text-[13px] text-ink-soft">
            {mode === "signup" ? "Already have an account? " : "No account yet? "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup")
                setProblem(null)
              }}
              className="border-b border-signal/40 font-medium text-signal transition-colors hover:border-signal"
            >
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>

          <p className="mt-4 text-[13px] text-ink-soft">
            Or{" "}
            <Link to="/app" className="border-b border-rule transition-colors hover:border-ink">
              use the bench without an account
            </Link>
            .
          </p>
        </div>
      </div>

      {/* ------------------------------ aside ----------------------------- */}
      <aside className="hidden flex-col justify-center border-l border-rule bg-plane px-12 lg:flex">
        <figure className="max-w-md">
          <blockquote className="display-md leading-snug">
            A prompt change with no measurement attached is a guess you are
            asking your users to verify.
          </blockquote>
          <figcaption className="mt-6 border-t border-rule pt-5 text-[13px] leading-relaxed text-ink-soft">
            The bench keeps the golden set, the graders and the baseline in one
            place so every change gets measured the same way.
          </figcaption>
        </figure>

        <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-rule pt-6">
          {[
            ["5", "graders per case"],
            ["3", "gates"],
            ["all", "spans recorded"],
          ].map(([value, label]) => (
            <div key={label}>
              <dd className="num text-[20px] font-medium leading-none">{value}</dd>
              <dt className="mt-1.5 text-[12px] leading-snug text-ink-faint">{label}</dt>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  )
}
