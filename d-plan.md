# Development Plan - Apple-Inspired E-Book Reader (MVP)

## 1. Project Overview
A minimalist, high-performance online EPUB reader built with React and Vite, following Apple's design philosophy. The app will focus on a distraction-free reading experience with local-first storage.

## 2. Core Features
- **Library Management**: Upload EPUB files and store them locally using IndexedDB.
- **EPUB Rendering**: High-fidelity rendering of EPUB content using `epub.js`.
- **Navigation Control**:
  - Desktop: Mouse wheel scrolling, Arrow keys for page turning.
  - Mobile: Touch swipe gestures for page turning.
- **Apple Design System**:
  - Cinematic light/dark theme.
  - SF Pro / Inter typography with tight tracking.
  - Translucent glass navigation.
  - Minimalist product-as-hero layout for the library.

## 3. Technical Stack
- **Frontend**: React 19 + Vite
- **Styling**: Tailwind CSS (Apple Design System configuration)
- **EPUB Engine**: `epubjs`
- **Storage**: `idb` (IndexedDB wrapper)
- **Icons**: `lucide-react`
- **Animations**: `motion` (framer-motion)

## 4. Development Phases

### Phase 1: Foundation & Design System
- Configure Tailwind with Apple's color palette and typography.
- Set up global styles (glass effects, transitions).
- Implement the `db.ts` utility for IndexedDB storage.

### Phase 2: Library & Upload
- Create the Library view with a "Product Hero" style upload zone.
- Implement file parsing and storage logic.
- Display stored books in a clean grid layout.

### Phase 3: Reader Engine
- Integrate `epubjs` for rendering.
- Implement the Reader view with a distraction-free layout.
- Add navigation logic (Keyboard, Mouse Wheel, Swipe).
- **New**: Fix white screen issues during sliding by optimizing rendition lifecycle and pre-fetching.
- **New**: Implement "Curl" (卷页) style page-turning animations or high-fidelity smooth transitions.
- **New**: Chinese Typography Optimization (PingFang SC, line-height 1.7, justified text).

### Phase 4: Polish & UX
- Add smooth transitions between Library and Reader views.
- Implement progress tracking (save last read position).
- Final design audit against Apple's "Do's and Don'ts".
- **New**: Adaptive layout refinements for various screen sizes.
- **New**: Enhance touch feedback and gesture responsiveness.

## 5. File Structure
- `src/lib/db.ts`: IndexedDB management.
- `src/components/Navigation.tsx`: Translucent top bar.
- `src/components/Library.tsx`: Book list and upload.
- `src/components/Reader.tsx`: EPUB viewer component.
- `src/types.ts`: TypeScript interfaces.
