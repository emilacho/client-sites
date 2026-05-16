import { HeroSection } from "@/components/sections/HeroSection"
import { MenuSection } from "@/components/sections/MenuSection"
import { AboutSection } from "@/components/sections/AboutSection"
import { CTASection } from "@/components/sections/CTASection"
import { ContactSection } from "@/components/sections/ContactSection"
import { Footer } from "@/components/sections/Footer"
import { WhatsAppFab } from "@/components/WhatsAppFab"

export default function LandingPage() {
  return (
    <main className="relative">
      <HeroSection />
      <MenuSection />
      <AboutSection />
      <CTASection />
      <ContactSection />
      <Footer />
      <WhatsAppFab />
    </main>
  )
}
