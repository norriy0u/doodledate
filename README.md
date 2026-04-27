# 🎨 Doodle Date

A whimsical collaborative drawing application where you draw on one half of the canvas, and an AI procedurally completes the other half. It's an artistic "date" with the Claude Vision API.

## ✨ Features
- **Interactive Canvas Engine**: A custom HTML5 Canvas drawing tool with color picking, variable brush sizes, an eraser, and a 10-step Undo stack.
- **Vision AI Analysis**: Once you finish your side, the app exports your drawing as a Base64 image and sends it to the Anthropic Claude Vision API to analyze your mood, style, and subject matter.
- **Procedural AI Artist**: Instead of generating a static image, the app's JavaScript engine parses the JSON response from Claude and uses `requestAnimationFrame` to procedurally draw complementary abstract/geometric shapes onto the AI's canvas in real-time.
- **Web Audio Ambience**: Enjoy a lo-fi 3-note piano arpeggio loop, synthesized "watercolor swoosh" sounds for every brush stroke, and a beating heart sound effect while the AI thinks.
- **Local Gallery**: All your finished dates are combined into a single downloadable image and saved directly to your browser's `localStorage` for the Date Gallery.

## 🚀 Getting Started
Open `index.html` in your browser, or serve locally:
```bash
python -m http.server 8080
```
*Note: To allow the AI to see your drawing, you must provide an Anthropic API key via the initial setup screen. This key is never stored centrally.*

## 🛠️ Tech Stack
- **HTML5 & CSS3**: Side-by-side canvas alignment, CSS fireworks animations, custom fonts (Caveat).
- **Vanilla JavaScript**: Drawing state management, Canvas path drawing, and mathematical bezier curve rendering.
- **Anthropic Vision API**: Real-time image analysis.
- **Web Audio API**: Real-time sound synthesis (oscillators and noise buffers).

---
*Built as part of the VishwaNova Weboreel Hackathon.*
