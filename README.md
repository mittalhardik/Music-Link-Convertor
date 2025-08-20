# 🎵 Music Link Converter

A modern web application that converts music links between Spotify and YouTube Music seamlessly. Built with Node.js, Express, and a beautiful responsive UI.

## ✨ Features

- **Spotify to YouTube Music**: Convert Spotify track links to YouTube Music
- **YouTube Music to Spotify**: Convert YouTube Music links to Spotify
- **Modern UI**: Beautiful, responsive design with smooth animations
- **Real-time Conversion**: Fast and accurate link conversion
- **Mobile Friendly**: Works perfectly on all devices

## 🚀 Quick Start

### Prerequisites

- Node.js 16.0.0 or higher
- npm or yarn
- Spotify API credentials (optional for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/music-link-converter.git
   cd music-link-converter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Spotify API credentials:
   ```env
   SPOTIFY_CLIENT_ID=your_spotify_client_id_here
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
   PORT=3000
   NODE_ENV=development
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 🎯 How to Use

1. **Enter a music link** from either Spotify or YouTube Music
2. **Click "Convert Link"** or press Enter
3. **Get converted links** for the other platform
4. **Click the links** to open them in your preferred music service

### Supported Link Formats

- **Spotify**: `https://open.spotify.com/track/...`
- **YouTube Music**: `https://music.youtube.com/watch?v=...` or `https://youtube.com/watch?v=...`

## 🛠️ Development

### Project Structure

```
music-link-converter/
├── server.js          # Express server with API endpoints
├── index.html         # Frontend UI
├── package.json       # Dependencies and scripts
├── .env.example       # Environment variables template
└── README.md          # This file
```

### Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with hot reload
- `npm run build` - Build the application (no build step required)
- `npm test` - Run tests (no tests configured yet)

### API Endpoints

- `POST /api/convert` - Convert music links
- `GET /api/health` - Health check endpoint
- `GET /` - Serve the main application

## 🚀 Deployment

### Deploy to Heroku

1. **Create a Heroku app**
   ```bash
   heroku create your-app-name
   ```

2. **Set environment variables**
   ```bash
   heroku config:set SPOTIFY_CLIENT_ID=your_spotify_client_id
   heroku config:set SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   heroku config:set NODE_ENV=production
   ```

3. **Deploy**
   ```bash
   git push heroku main
   ```

### Deploy to Railway

1. **Connect your GitHub repository** to Railway
2. **Set environment variables** in the Railway dashboard
3. **Deploy automatically** on every push

### Deploy to Vercel

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

### Deploy to DigitalOcean App Platform

1. **Create a new app** in DigitalOcean App Platform
2. **Connect your GitHub repository**
3. **Set environment variables** in the app settings
4. **Deploy**

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 3000 |
| `NODE_ENV` | Environment mode | No | development |
| `SPOTIFY_CLIENT_ID` | Spotify API client ID | No* | Demo credentials |
| `SPOTIFY_CLIENT_SECRET` | Spotify API client secret | No* | Demo credentials |

*Required for production deployment

### Getting Spotify API Credentials

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new application
3. Copy the Client ID and Client Secret
4. Add them to your environment variables

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Spotify Web API](https://developer.spotify.com/documentation/web-api/)
- [YouTube Music API](https://github.com/sigma67/ytmusicapi)
- [Express.js](https://expressjs.com/)
- [Axios](https://axios-http.com/)

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/yourusername/music-link-converter/issues) page
2. Create a new issue with detailed information
3. Include your Node.js version and operating system

---

Made with ❤️ for music lovers everywhere 