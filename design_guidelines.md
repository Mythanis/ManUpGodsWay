# Design Guidelines: "Man Up God's Way" Spiritual Development Platform

## Design Approach

**Reference-Based Approach**: Drawing inspiration from modern wellness and faith-based community platforms (YouVersion Bible, Headspace, Calm) combined with contemporary SaaS aesthetics (Linear, Notion). The design emphasizes clarity, spiritual warmth, and purposeful organization that supports men's faith journey without distraction.

**Core Principles**: 
- Generous breathing room over content density
- Soft, welcoming professionalism
- Hierarchical clarity for spiritual content
- Subtle depth through layered shadows
- Focus-driven layouts that guide spiritual growth

---

## Typography System

**Primary Font**: Inter or DM Sans (Google Fonts) - clean, modern, highly readable
**Secondary Font**: Crimson Pro or Merriweather - for scripture quotes and reflective content

**Hierarchy**:
- Hero Headlines: 4xl-6xl (text-5xl lg:text-6xl), font-bold, tight leading (leading-tight)
- Section Headers: 3xl-4xl (text-3xl lg:text-4xl), font-semibold
- Subheadings: xl-2xl (text-xl lg:text-2xl), font-medium
- Body Text: base-lg (text-base lg:text-lg), font-normal, comfortable line-height (leading-relaxed)
- Scripture Quotes: lg-xl, secondary font, italic, slightly elevated line-height (leading-loose)
- Captions/Labels: sm-base, font-medium, subtle weight

---

## Layout & Spacing System

**Tailwind Spacing Primitives**: Use units of 4, 6, 8, 12, 16, 20, 24 for consistency
- Component padding: p-6, p-8
- Section spacing: py-16, py-20, py-24 (desktop), py-12 (mobile)
- Card gaps: gap-6, gap-8
- Content margins: mb-4, mb-6, mb-8

**Container Strategy**:
- Full-width sections: w-full with max-w-7xl mx-auto px-6
- Content sections: max-w-6xl mx-auto
- Reading content: max-w-3xl (optimal reading width)

---

## Component Library

### Navigation
Sticky header with subtle backdrop blur, shadow-sm on scroll. Logo left, navigation center (desktop) or hamburger right (mobile). Includes: Home, Teachings, Community, Resources, Sign In/Join buttons (Join button with subtle background, Sign In as text link).

### Hero Section (Full-Screen Impact)
**Height**: min-h-screen with centered content
**Image**: Large inspirational hero image - silhouette of man on mountain/looking at sunrise, symbolizing spiritual ascent and new beginnings. Image should have subtle gradient overlay (dark to transparent from bottom) for text legibility.
**Layout**: Centered vertical stack
- Eyebrow text above headline (text-sm uppercase tracking-wide, mb-4)
- Main headline (text-5xl lg:text-6xl font-bold mb-6)
- Supporting paragraph (text-lg lg:text-xl max-w-2xl mb-8)
- CTA buttons: Primary "Begin Your Journey" with blurred background (backdrop-blur-md bg-white/20), Secondary "Explore Content" (transparent with border)
- Trust indicator below buttons: "Join 12,000+ men growing in faith" with small community avatars

### Mission Statement Section
**Layout**: Full-width with subtle background treatment
**Content**: Two-column on desktop (60/40 split)
- Left: Compelling mission narrative (max-w-2xl)
- Right: Key statistics grid (2x2) - Members, Daily Active, Communities, Years Active
- Stats use large numbers (text-4xl font-bold) with labels (text-sm)

### Core Features Section
**Layout**: Three-column grid (grid-cols-1 md:grid-cols-3 gap-8)
Each feature card includes:
- Icon container (w-12 h-12 with subtle background, rounded-xl, mb-4)
- Feature title (text-xl font-semibold mb-3)
- Description (text-base leading-relaxed)
- "Learn more" link with arrow icon

Features: "Daily Devotionals & Teaching", "Brotherhood & Accountability", "Spiritual Growth Tracking"

### How It Works Section
**Layout**: Alternating image-text rows (3 steps)
- Step 1 (Image left): "Start Your Journey" - signup/onboarding imagery
- Step 2 (Image right): "Engage Daily" - man using app for devotional
- Step 3 (Image left): "Grow Together" - community/group discussion imagery

Each row:
- Step number badge (large, subtle treatment)
- Step headline (text-2xl font-semibold mb-4)
- Description paragraph (max-w-lg)
- Image side: rounded-2xl with shadow-xl

### Community Impact Section
**Layout**: Background with subtle treatment, full-width
**Content**: Testimonials carousel/grid (3 columns on desktop)
Each testimonial card (bg-white, rounded-xl, shadow-md, p-8):
- Quote (text-lg, secondary font, italic, mb-6)
- Author photo (rounded-full, w-16 h-16)
- Name and role (font-semibold + text-sm)
- Star rating display above quote

### Resources Preview Section
**Layout**: Two-column showcase
- Left: "Access Powerful Resources" headline + description
- Right: Stacked resource cards (4-5 cards, slightly offset/overlapping)
  Each card shows: resource type icon, title, brief description, "Access" link

### Final CTA Section
**Layout**: Centered, generous padding (py-24)
**Image**: Background image - men in small group/prayer circle, with dark gradient overlay
**Content**: 
- Compelling headline (text-4xl font-bold mb-6)
- Supporting text (text-xl mb-8)
- Primary CTA button (large, blurred background as hero)
- Trust badges below: "100% Free to Start" | "Cancel Anytime" | "Private & Secure"

### Footer
**Layout**: Multi-column (4 columns desktop, stack mobile)
- Column 1: Logo + mission tagline
- Column 2: Quick Links (About, Teaching, Community, Contact)
- Column 3: Resources (Blog, Podcast, Newsletter, App)
- Column 4: Newsletter signup form + social links
- Bottom bar: Copyright, Privacy Policy, Terms

---

## Shadow & Depth System

**Elevation Levels**:
- Cards at rest: shadow-md
- Cards hover: shadow-lg (transition)
- Modals/overlays: shadow-2xl
- Sticky header: shadow-sm
- Feature highlights: shadow-xl

---

## Images Requirements

**Hero Image**: Man on mountain summit at sunrise, arms raised in worship/victory pose. Inspirational, aspirational, symbolizing spiritual growth and overcoming. High-quality, professional photography.

**Mission Section**: Optional background texture - subtle paper/fabric texture

**How It Works Images**:
- Step 1: Clean app interface on phone, welcoming onboarding screen
- Step 2: Man reading devotional on tablet/phone, morning setting
- Step 3: Small group of men in discussion, warm authentic setting

**Community Impact**: Authentic testimonial photos - diverse men, genuine expressions

**Final CTA Background**: Men in prayer circle or accountability group, warm lighting, authentic connection

**Resources Preview**: Screenshots of resource types - teaching videos, study guides, prayer journals

All images should feel authentic, warm, and professionally captured - avoid stock photo stigma.