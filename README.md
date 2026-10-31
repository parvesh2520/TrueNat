# TrueNat 3D Interactive Device Viewer

An interactive 3D web application showcasing the **TrueNat Real-Time PCR Device** with detailed component inspection, step-by-step diagnostic workflow, and technical specifications.

Built with **Three.js**, **TypeScript**, and **Vite**.

---

## 🚀 Features

- **3D Device Visualization**: High-fidelity rendering of the TrueNat RT-PCR system with procedural geometry and realistic materials.
- **Interactive Exploded View & Hotspots**: Inspect individual sub-assemblies (optical detection system, micro-PCR reaction chamber, cartridge slot, battery compartment, and touchscreen UI).
- **Step-by-Step Diagnostic Workflow**: Interactive guide covering Sample Collection, RNA/DNA Extraction, Cartridge Loading, and Micro-PCR Amplification & Detection.
- **Smooth Navigation & Controls**: Integrated with Lenis smooth scrolling and OrbitControls.
- **Responsive Design**: Optimized for desktop, tablet, and mobile viewing.

---

## 🛠️ Tech Stack

- **Framework / Bundler**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **3D Graphics**: [Three.js](https://threejs.org/)
- **Smooth Scrolling**: [Lenis](https://lenis.darkroom.engineering/)

---

## 📦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` (included with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/parvesh2520/TrueNat.git

# Navigate into the project directory
cd TrueNat

# Install dependencies
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to view the application.

### Production Build

```bash
npm run build
```

The compiled output will be generated in the `dist` directory.

---

## 🌐 Deploy to Vercel

1. Push your repository to GitHub.
2. Visit [Vercel](https://vercel.com) and log in.
3. Click **Add New...** > **Project**.
4. Import the `TrueNat` repository.
5. Vercel automatically detects **Vite**:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Click **Deploy**.
