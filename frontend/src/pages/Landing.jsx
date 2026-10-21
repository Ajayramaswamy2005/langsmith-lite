import React, { useEffect } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import TopBar from "@/components/site/TopBar"
import Instrument from "@/components/site/Instrument"
import {
  Closing,
  EarnsKeep,
  Footer,
  Measures,
  Pricing,
  Questions,
  Sequence,
  ToleranceStrip,
  Traces,
} from "@/components/site/sections"

export default function Landing() {
  useEffect(() => {
    document.title = "LangSmith Lite — run the prompt change on the bench first"
  }, [])

  return (
    <div className="min-h-screen">
      <TopBar />

      {/* ------------------------------- hero ------------------------------- */}
      <section className="sheet ruled py-14 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:items-center lg:gap-16">
          <div>
            <h1 className="display-xl max-w-[17ch]">
              Every prompt change is an experiment. Run it on the bench first.
            </h1>

            <p className="measure mt-6 text-[17px] leading-relaxed text-ink-soft">
              LangSmith Lite grades a prompt against a golden set of cases you
              curate, records a trace for every one, and measures the result
              against your last known-good run. You ship when the quality,
              latency and cost readings sit inside tolerance.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to="/login?mode=signup">Start a run</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/app">Open the bench</Link>
              </Button>
            </div>

            <dl className="mt-10 flex flex-wrap items-baseline gap-x-8 gap-y-3 border-t border-rule pt-5">
              {[
                ["graders per case", "5"],
                ["spans recorded", "all"],
                ["gates", "3"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline gap-2">
                  <dd className="num text-[17px] font-medium leading-none">{value}</dd>
                  <dt className="text-[12.5px] text-ink-faint">{label}</dt>
                </div>
              ))}
            </dl>
          </div>

          <div className="min-w-0 lg:pl-4">
            <Instrument />
          </div>
        </div>
      </section>

      <ToleranceStrip />
      <Measures />
      <Traces />
      <Sequence />
      <EarnsKeep />
      <Pricing />
      <Questions />
      <Closing />
      <Footer />
    </div>
  )
}
