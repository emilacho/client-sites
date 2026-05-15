import { HeroSection } from "@/components/sections/HeroSection"
import { ServicesSection } from "@/components/sections/ServicesSection"
import { AboutSection } from "@/components/sections/AboutSection"
import { CTASection } from "@/components/sections/CTASection"
import { ContactSection } from "@/components/sections/ContactSection"
import { Footer } from "@/components/sections/Footer"

export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <ServicesSection />
      <AboutSection />
      <CTASection />
      <ContactSection />
      <Footer />
    </main>
  )
}
