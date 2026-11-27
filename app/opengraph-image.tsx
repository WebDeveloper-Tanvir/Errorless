import { ogImage, OG_SIZE } from "@/lib/seo/og"

export const alt = "Errorless: AI error debugger that finds the root cause"
export const size = OG_SIZE
export const contentType = "image/png"

export default function Image() {
  return ogImage("Stop fighting bugs. Find the root cause.", "Paste an error. Get the cause, the evidence and the smallest safe fix.", ["Python", "JavaScript", "React", "Docker", "SQL"])
}
