import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { SectionHeading } from "@/components/landing/section-heading"

export const FAQ_ITEMS = [
  {
    q: "What does Errorless actually do?",
    a: "It analyzes code you give it, points to the line behind each problem, explains why it is a problem and suggests a fix. Instant static checks run in your browser. Dev Mode adds AI review for logic, security and performance, plus code generation and optimization.",
  },
  {
    q: "Is my code sent anywhere?",
    a: "The static analyzer in the editor, IDE and landing-page preview runs locally in your browser. Dev Mode analysis, generation and optimization send your code to Google's Gemini API through Errorless's servers to produce the result. Dev Mode's saved session memory is stored in your browser.",
  },
  {
    q: "Which languages are supported?",
    a: "Python, JavaScript, TypeScript and Java have dedicated analysis rules. C, C++, C#, Go, Rust, Ruby, PHP, Swift, Kotlin, HTML, CSS and SQL are detected from the file extension and covered by AI review in Dev Mode.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. A free account includes the editor and IDE with static analysis. Dev Mode, which adds AI analysis, code generation and optimization, has Basic and Premium plans.",
  },
  {
    q: "What is the difference between Basic and Premium?",
    a: "Basic includes code generation and AI analysis, with memory that resets every 24 hours. Premium adds code optimization, permanent saved memory and priority AI processing.",
  },
  {
    q: "How do I pay?",
    a: "Open Dev Mode, choose a plan and scan the UPI QR code with any UPI app. Then enter the 12-digit transaction ID from your receipt. Your plan is activated once the payment is verified. Prices are in INR; the USD amounts shown are approximate.",
  },
] as const

export function FAQ() {
  return (
    <section id="faq" className="border-t border-border bg-surface/40 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />
        <Accordion type="single" collapsible className="mt-12 rounded-2xl border border-border bg-card px-6 shadow-card">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={item.q} value={`item-${i}`} className="border-border last:border-b-0">
              <AccordionTrigger className="py-5 text-left text-base font-medium hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
