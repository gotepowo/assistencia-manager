# Gotelip Assistência

A modern, fully offline desktop application for managing technical assistance businesses.

Designed for repair shops that work with smartphones, computers, notebooks, consoles and other electronic devices, the application provides an intuitive interface for managing customers, service orders, finances and reports—all without requiring an internet connection.

---

## Features

* 💻 Fully offline desktop application
* 📋 Service order management
* 👥 Customer management
* 💰 Financial control
* 🧾 Invoice management
* 📊 Reports and statistics
* 📁 CSV import and export
* 🖼️ Local file attachments
* 💾 Automatic local data storage
* 🔄 Portable Windows executable
* 🚀 Fast and lightweight

---

## Screenshots

> Screenshots coming soon.

---

## Technologies

* React
* Vite
* Electron
* Electron Builder

---

## Requirements

* Node.js 20 or newer
* npm

Download Node.js:

https://nodejs.org/

---

## Installation

Clone the repository:

```bash
git clone https://github.com/gotepowo/gotelip-manager.git
```

Enter the project folder:

```bash
cd gotelip-manager
```

Install dependencies:

```bash
npm install
```

---

## Development

Run the application in development mode:

```bash
npm run dev:electron
```

This starts both:

* Vite
* Electron

with Hot Reload enabled.

---

## Building

Build the React application:

```bash
npm run build
```

Generate the portable Windows executable:

```bash
npm run build:portable
```

The executable will be generated inside the `release` folder.

---

## Local Storage

All application data is stored locally.

When the application is launched, it automatically creates the following folders next to the executable:

```text
data/
uploads/
backups/
```

The database is stored as:

```text
data/database.json
```

Uploaded files are stored inside:

```text
uploads/
```

Backups are stored inside:

```text
backups/
```

No cloud services or external databases are required.

---

## Updating

Simply replace the executable with a newer version.

Keep the following folders:

```text
data/
uploads/
backups/
```

Your information will remain intact.

---

## Roadmap

Planned features include:

* Automatic service order saving
* Invoice linking
* Cloud synchronization
* Multi-device support
* Android companion application
* Improved reporting
* Automatic backups
* PDF improvements

---

## License

This project is source-available.

You are welcome to use the software within your own business and modify it for internal use.

Commercial redistribution, resale, rebranding or selling modified versions of this software is prohibited without prior written permission.

See `LICENSE.md` for complete license information.

---

## Author

Developed by **Thiago Rodrigues Gotelip**.

If you have suggestions, bug reports or feature requests, feel free to open an issue on GitHub.
