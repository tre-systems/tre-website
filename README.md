# Total Reality Engineering Website

A minimal, elegant portfolio website showcasing GitHub projects with a terminal-inspired design.

## 🚀 Quick Start

```bash
# Serve locally
npx serve .

# Update projects from GitHub
node build-projects.js
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Structure

```
├── index.html         # Main page
├── styles.css         # All styling
├── script.js          # Animations & interactions
├── build-projects.js  # GitHub project fetcher
├── favicon.svg        # Site icon
└── logo192.png        # PWA icon
```

## 🔄 Updating Projects

Projects are fetched from GitHub and injected into `index.html`. This happens:
- **Automatically**: Daily via GitHub Actions
- **Manually**: Run `node build-projects.js`

To use a GitHub token for higher rate limits:
```bash
GITHUB_TOKEN=your_token node build-projects.js
```

## 🎨 Design

- **Colors**: Black background (#000), Terminal green (#39FF14), White text
- **Fonts**: Inter (body), JetBrains Mono (headings/code)
- **Animations**: CSS keyframes for glow, fade-in, slide-up effects

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 👨‍💻 Author

**Robert Gilks** - [LinkedIn](https://www.linkedin.com/in/rob-gilks-39bb03/) | [GitHub](https://github.com/rgilks)

Total Reality Engineering • Founded Australia 1998 • UK 2008
