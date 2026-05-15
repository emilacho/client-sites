import { HeroSection } from "@/components/sections/HeroSection"
import { MenuSection } from "@/components/sections/MenuSection"
import { AboutSection } from "@/components/sections/AboutSection"
import { CTASection } from "@/components/sections/CTASection"
import { Footer } from "@/components/sections/Footer"

export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <MenuSection />
      <AboutSection />
      <CTASection />
      <Footer />
    </main>
  )
}
